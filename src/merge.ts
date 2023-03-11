import {XmlDocument, XmlElement, XmlNode} from 'xmldoc';
import levenshtein from 'js-levenshtein';

type MergeOptions = {
    excludeFiles?: string[],
    fuzzyMatch?: boolean,
    collapseWhitespace?: boolean,
    resetTranslationState?: boolean,
    sourceLanguage?: boolean,
    replaceApostrophe?: boolean,
    newTranslationTargetsBlank?: boolean | 'omit',
    /** For untranslated units with initial state (state="initial" / state="new"), a updated source will be copied into the target */
    syncTargetsWithInitialState?: boolean,
};

const FUZZY_THRESHOLD = 0.2;

const STATE_INITIAL_XLF_2_0 = 'initial';
const STATE_INITIAL_XLF_1_2 = 'new';


function findCloseMatches(originUnit: XmlElement, destUnits: XmlElement[]): { elem: XmlElement, score: number }[] {
    const originText = toString(getSourceElement(originUnit)!);
    return destUnits
        .filter(n => n.type === 'element')
        .map(n => ({
            elem: n,
            score: levenshtein(originText, toString(getSourceElement(n as XmlElement)!)) / originText.length
        }))
        .filter(x => x.score < FUZZY_THRESHOLD)
        .sort((a, b) => a.score - b.score); // TODO test
}

function toString(...nodes: XmlNode[]): string {
    return nodes.map(n => n.toString({preserveWhitespace: true, compressed: true})).join('');
}

function collapseWhitespace(destSourceText: string) {
    return destSourceText.replace(/\s+/g, ' ');
}

function getUnits(doc: XmlDocument, xliffVersion: '1.2' | '2.0') {
    return xliffVersion === '2.0' ? doc.childNamed('file')?.childrenNamed('unit') : doc.childNamed('file')?.childNamed('body')?.childrenNamed('trans-unit');
}

function getSourceElement(unit: XmlElement): XmlElement | undefined {
    // xliff 2.0: ./segment/source; xliff 1.2: ./source
    return unit.childNamed('segment')?.childNamed('source') ?? unit.childNamed('source');
}

function getTargetElement(unit: XmlElement): XmlElement | undefined {
    // xliff 2.0: ./segment/target; xliff 1.2: ./target
    return unit.childNamed('segment')?.childNamed('target') ?? unit.childNamed('target');
}

function createTargetElement(unit: XmlElement, xliffVersion: '1.2' | '2.0'): XmlElement {
    // xliff 2.0: ./segment/target; xliff 1.2: ./target
    const parent = xliffVersion === '2.0' ? unit.childNamed('segment')! : unit;
    const targetElement = new XmlDocument('<target></target>');
    parent.children.push(targetElement)
    updateFirstAndLastChild(parent);
    return targetElement;
}

function resetTranslationState(destUnit: XmlElement, xliffVersion: '1.2' | '2.0', options?: MergeOptions) {
    if (options?.resetTranslationState ?? true) {
        if (xliffVersion === '2.0') {
            destUnit.childNamed('segment')!.attr.state = options?.sourceLanguage ? 'final' : STATE_INITIAL_XLF_2_0;
        } else {
            const targetNode = destUnit.childNamed('target');
            if (targetNode) {
                targetNode.attr.state = options?.sourceLanguage ? 'final' : STATE_INITIAL_XLF_1_2;
            }
        }
    }
}

function isInitialState(destUnit: XmlElement, xliffVersion: '1.2' | '2.0'): boolean {
    if (xliffVersion === '2.0') {
        const state20 = destUnit.childNamed('segment')?.attr.state;
        return state20 === undefined || state20 === STATE_INITIAL_XLF_2_0;
    } else {
        const state12 = destUnit.childNamed('target')?.attr.state;
        return state12 === undefined || state12 === STATE_INITIAL_XLF_1_2;
    }
}

function revertApostrophes(s: string, revertApos: boolean): string {
    return revertApos ? s.replace(/&apos;/g, '\'') : s;
}

function updateFirstAndLastChild(destUnit: XmlElement) {
    destUnit.firstChild = destUnit.children[0];
    destUnit.lastChild = destUnit.children[destUnit.children.length - 1];
}

function isUntranslated(destUnit: XmlElement, xliffVersion: '1.2' | '2.0', destSourceText: string): boolean {
    const targetElement = getTargetElement(destUnit);
    const destTargetText = toString(...targetElement?.children ?? []);
    return isInitialState(destUnit, xliffVersion) && (!targetElement || destSourceText === destTargetText);
}

function createEmptyTarget(isXliffV2: boolean, srcLang: string, targetLang: string): string {
    if (isXliffV2) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="${srcLang}" trgLang="${targetLang}">
  <file original="ng.template" id="ngi18n">
  </file>
</xliff>`;
    } else {
        return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="${srcLang}" target-language="${targetLang}" datatype="plaintext" original="ng2.template">
    <body>
    </body>
  </file>
</xliff>`;
    }
}

function extractSourceLocale(translationSourceFile: XmlDocument, isXliffV2: boolean): string {
    return (isXliffV2 ? translationSourceFile?.attr.srcLang : translationSourceFile?.childNamed('file')?.attr['source-language']) ?? 'en'
}

function extractTargetLocale(targetPath: string | undefined): string {
    return targetPath?.match(/\.([a-zA-Z-]+)\.xlf$/)?.[1] ?? 'en';
}

export function merge(inFilesContent: string | string[], destFileContent: string, options?: MergeOptions, destFilePath?: string): string {
    const [mergedDestFileContent] = mergeWithMapping(inFilesContent, destFileContent, options, destFilePath);
    return mergedDestFileContent;
}

/**
 * syncs all elements from `source` to `dest` that are not in `ignoreElementNames`.
 * @param source
 * @param target
 * @param ignoreElementNames
 */
function syncOtherNodes(source: XmlElement, target: XmlElement, ...ignoreElementNames: string[]): void {
    const targetNodesByName = new Map<string, XmlElement[]>();
    target.children.filter((n): n is XmlElement => n.type === 'element')
        .forEach(node => targetNodesByName.set(node.name, [...(targetNodesByName.get(node.name) ?? []), node]));
    const sourceNodesByName = new Map<string, XmlElement[]>();
    source.children.filter((n): n is XmlElement => n.type === 'element')
        .forEach(node => sourceNodesByName.set(node.name, [...(sourceNodesByName.get(node.name) ?? []), node]));

    // remove all nodes that are not in source:
    const removeSuperfluousTargetNodes = [...targetNodesByName.entries()].filter(([name]) => !ignoreElementNames.includes(name))
        .map(([name, nodes]) => nodes.slice(0, nodes.length - (sourceNodesByName.get(name)?.length ?? 0)))
        .flat();
    removeChildren(target, ...removeSuperfluousTargetNodes);

    let i = 0;
    let sourceOffset = 0;
    let targetOffset = 0;
    while (i + sourceOffset < source.children.length) {
        const targetElement = target.children?.[i + targetOffset];
        const sourceElement = source.children[i + sourceOffset];
        if (!(sourceElement.type === 'element') || ignoreElementNames.includes(sourceElement.name)) {
            sourceOffset++;
        } else if (i + targetOffset < target.children.length && (!(targetElement?.type === 'element') || ignoreElementNames.includes(targetElement.name))) {
            targetOffset++;
        } else if (targetElement?.type === 'element' && targetElement.name === sourceElement.name) {
            targetElement.children = sourceElement.children;
            targetElement.attr = sourceElement.attr;
            updateFirstAndLastChild(targetElement);
            i++;
        } else {
            target.children.splice(i + targetOffset, 0, sourceElement);
            i++;
        }
        updateFirstAndLastChild(target);
    }
}

function getMinScoreId(bestMatchesIdToUnits: Map<string, { elem: XmlElement; score: number }[]>): string | undefined {
    let minScoreId: string | undefined;
    let minScore = Number.MAX_VALUE;
    bestMatchesIdToUnits.forEach((x, id) => {
        if (x.length) {
            const score = x[0].score;
            if (score < minScore) {
                minScore = score;
                minScoreId = id;
            }
        }
    });
    return minScoreId;
}

export function mergeWithMapping(inFilesContent: string | string[], destFileContent: string, options?: MergeOptions, destFilePath?: string): [mergedDestFileContent: string, idMappging: { [oldId: string]: string }] {
    inFilesContent = Array.isArray(inFilesContent) ? inFilesContent : [inFilesContent];
    const inDocs = inFilesContent.map(inFileContent => new XmlDocument(inFileContent));
    const xliffVersion = inDocs[0].attr.version as '1.2' | '2.0' ?? '1.2';

    const destDoc = new XmlDocument(destFileContent.match(/^[\n\r\s]*$/) ? createEmptyTarget(xliffVersion === '2.0', extractSourceLocale(inDocs[0], xliffVersion === '2.0'), extractTargetLocale(destFilePath)) : destFileContent);
    const excludeDocs = (options?.excludeFiles ?? []).map(excludeFile => new XmlDocument(excludeFile));

    const destUnitsParent = xliffVersion === '2.0' ? destDoc.childNamed('file')! : destDoc.childNamed('file')?.childNamed('body')!;
    const excludeUnits = excludeDocs.map(excludeDoc => getUnits(excludeDoc, xliffVersion) ?? []).flat(1);
    const excludeUnitsId = new Set<string>(excludeUnits.map(unit => unit.attr.id!));
    const inUnits = inDocs.map(inDoc => getUnits(inDoc, xliffVersion) ?? []).flat(1).filter(inUnit => !excludeUnitsId .has(inUnit.attr.id));
    const inUnitsById = new Map<string, XmlElement>(inUnits.map(unit => [unit.attr.id!, unit]));
    const destUnitsById = new Map<string, XmlElement>((getUnits(destDoc, xliffVersion) ?? []).map(unit => [unit.attr.id!, unit]));
    const allInUnitsWithoutDestinationUnit = inUnits.filter(u => !destUnitsById.has(u.attr.id));
    const allInUnitsWithDestinationUnit = inUnits.filter(u => destUnitsById.has(u.attr.id));

    // collect (potentially) obsolete units (defer actual removal to allow for fuzzy matching..):
    const removeNodes = getUnits(destDoc, xliffVersion)!.filter(destUnit => !inUnitsById.has(destUnit.attr.id));

    const idMapping: { [id: string]: string } = {};

    /** Syncs `unit` to `destUnit` or adds `unit` as new, if `destUnit` is not given. */
    function handle(unit: XmlElement, destUnit: XmlElement | undefined) {
        const unitSource = getSourceElement(unit)!;
        const unitSourceText = toString(...unitSource.children);
        if (destUnit) {
            const destSource = getSourceElement(destUnit)!;
            const destSourceText = toString(...destSource.children);
            const originTarget = getTargetElement(unit);
            const originTargetText = originTarget ? toString(...originTarget?.children) : '';
            const destTarget = getTargetElement(destUnit);
            const destTargetText = destTarget ? toString(...destTarget?.children) : '';
            if (options?.collapseWhitespace ?? true ? collapseWhitespace(destSourceText) !== collapseWhitespace(unitSourceText)
                || (originTarget && collapseWhitespace(originTargetText) !== collapseWhitespace(destTargetText)) : destSourceText !== unitSourceText
                || (originTarget && originTargetText !== destTargetText)) {
                destSource.children = unitSource.children;
                if (originTarget || options?.sourceLanguage || (options?.syncTargetsWithInitialState === true && isUntranslated(destUnit, xliffVersion, destSourceText))) {
                    const targetElement = destTarget ?? createTargetElement(destUnit, xliffVersion);
                    targetElement!.children = originTarget? originTarget.children : unitSource.children;
                }
                updateFirstAndLastChild(destSource);
                resetTranslationState(destUnit, xliffVersion, options);
                console.debug(`update element with id "${unit.attr.id}" with new source: ${toString(...destSource.children)} (was: ${destSourceText})`);
            }
            if (destUnit.attr.id !== unit.attr.id) {
                console.debug(`matched unit with previous id "${destUnit.attr.id}" to new id: "${unit.attr.id}"`);
                idMapping[destUnit.attr.id] = unit.attr.id;
                removeNodes.splice(removeNodes.indexOf(destUnit), 1);
                destUnit.attr.id = unit.attr.id;
                resetTranslationState(destUnit, xliffVersion, options);
            }

            syncOtherNodes(unit, destUnit, 'source', 'target', 'segment');
            updateFirstAndLastChild(destUnit);
        } else {
            console.debug(`adding element with id "${unit.attr.id}"`);
            if (!getTargetElement(unit)) {
                if (options?.newTranslationTargetsBlank !== 'omit') {
                    const shouldBeBlank = (options?.newTranslationTargetsBlank ?? false) && !(options?.sourceLanguage ?? false);
                    const targetNode = new XmlDocument(`<target>${shouldBeBlank ? '' : unitSourceText}</target>`);
                    if (xliffVersion === '2.0') {
                        const segmentSource = unit.childNamed('segment')!;
                        segmentSource.children.push(targetNode);
                    } else {
                        const sourceIndex = unit.children.indexOf(unitSource);
                        unit.children.splice(sourceIndex + 1, 0, targetNode);
                    }
                }
                resetTranslationState(unit, xliffVersion, options);
            }
            destUnitsParent.children.push(unit);
            updateFirstAndLastChild(destUnitsParent);
        }
    }

    for (const unit of allInUnitsWithDestinationUnit) {
        handle(unit, destUnitsById.get(unit.attr.id));
    }

    if (options?.fuzzyMatch ?? true) {
        const bestMatchesIdToUnits = new Map<string, { elem: XmlElement, score: number }[]>(allInUnitsWithoutDestinationUnit.map((inUnit: XmlElement) => [inUnit.attr.id!, findCloseMatches(inUnit, removeNodes)]));
        while (bestMatchesIdToUnits.size) {
            const inUnitId: string = getMinScoreId(bestMatchesIdToUnits) ?? [...bestMatchesIdToUnits.keys()][0];
            const bestMatch: XmlElement | undefined = bestMatchesIdToUnits.get(inUnitId)![0]?.elem;
            handle(inUnitsById.get(inUnitId)!, bestMatch);
            bestMatchesIdToUnits.delete(inUnitId);
            if (bestMatch) {
                bestMatchesIdToUnits.forEach(x => {
                    const i = x.findIndex(y => y.elem === bestMatch);
                    if (i >= 0) {
                        x.splice(i, 1);
                    }
                });
            }

        }
    } else {
        for (const unit of allInUnitsWithoutDestinationUnit) {
            handle(unit, undefined);
        }
    }

    console.debug(`removing ${removeNodes.length} ids: ${removeNodes.map(n => n.attr.id).join(', ')}`);
    removeChildren(destUnitsParent, ...removeNodes);

    // retain xml declaration:
    const xmlDecMatch = destFileContent.match(/^<\?xml [^>]*>\s*/i);
    const xmlDeclaration = xmlDecMatch ? xmlDecMatch[0] : '';

    const mergedContent = xmlDeclaration + revertApostrophes(destDoc.toString({
        preserveWhitespace: true,
        compressed: true
    }), !options?.replaceApostrophe);
    return [mergedContent, idMapping];
}

/**
 * Automatically removes whitespace text nodes before children.
 *
 * @param node
 * @param children
 */
function removeChildren(node: XmlElement, ...children: XmlNode[]): void {
    const removeIndexes = new Set<number>(node.children.map((c, i) => children.indexOf(c) >= 0 ? i : null).filter(x => x !== null) as number[]);
    node.children = node.children.filter((c, i) => !removeIndexes.has(i) && (!removeIndexes.has(i + 1) || !isWhiteSpace(c)));
    updateFirstAndLastChild(node);
}

function isWhiteSpace(node: XmlNode): boolean {
    return node.type === 'text' && !!node.text.match(/^\s*$/);
}
