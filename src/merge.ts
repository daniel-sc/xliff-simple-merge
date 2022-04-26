import {XmlDocument, XmlElement, XmlNode} from 'xmldoc';
import levenshtein from 'js-levenshtein';

type MergeOptions = {
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

function getDestUnit(originUnit: XmlElement, destUnitsParent: XmlElement, removedNodes: XmlNode[]): XmlElement | undefined {
    const destUnit = destUnitsParent.childWithAttribute('id', originUnit.attr.id);
    if (destUnit) {
        return destUnit;
    } else {
        const originText = toString(getSourceElement(originUnit)!);
        const closestUnit = removedNodes
            .filter(n => n.type === 'element')
            .map(n => ({
                node: n,
                dist: levenshtein(originText, toString(getSourceElement(n as XmlElement)!))
            }))
            .reduce((previousValue, currentValue) => (previousValue?.dist ?? Number.MAX_VALUE) > currentValue.dist ? currentValue : previousValue, undefined as { node: XmlNode, dist: number } | undefined);
        if (closestUnit && closestUnit.dist / originText.length < FUZZY_THRESHOLD) {
            return closestUnit.node as XmlElement;
        } else {
            return undefined;
        }
    }
}

function toString(...nodes: XmlNode[]): string {
    return nodes.map(n => n.toString({preserveWhitespace: true, compressed: true})).join('');
}

function collapseWhitespace(destSourceText: string) {
    return destSourceText.trim().replace(/\s+/, ' ');
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

function resetTranslationState(destUnit: XmlElement, xliffVersion: '1.2' | '2.0', options?: MergeOptions) {
    if (options?.resetTranslationState ?? true) {
        if (xliffVersion === '2.0') {
            destUnit.childNamed('segment')!.attr.state = options?.sourceLanguage ? 'final' : STATE_INITIAL_XLF_2_0;
        } else {
            destUnit.childNamed('target')!.attr.state = options?.sourceLanguage ? 'final' : STATE_INITIAL_XLF_1_2;
        }
    }
}

function isInitialState(destUnit: XmlElement, xliffVersion: '1.2' | '2.0'): boolean {
    if (xliffVersion === '2.0') {
        return destUnit.childNamed('segment')?.attr.state === STATE_INITIAL_XLF_2_0;
    } else {
        return destUnit.childNamed('target')?.attr.state === STATE_INITIAL_XLF_1_2;
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
    const destTargetText = toString(...getTargetElement(destUnit)?.children ?? []);
    return isInitialState(destUnit, xliffVersion) && destSourceText === destTargetText;
}

export function merge(inFileContent: string, destFileContent: string, options?: MergeOptions) {
    const inDoc = new XmlDocument(inFileContent);
    const destDoc = new XmlDocument(destFileContent);

    const xliffVersion = inDoc.attr.version as '1.2' | '2.0' ?? '1.2';

    const destUnitsParent = xliffVersion === '2.0' ? destDoc.childNamed('file')! : destDoc.childNamed('file')?.childNamed('body')!;
    const inUnits = getUnits(inDoc, xliffVersion) ?? [];

    // collect (potentially) obsolete units (defer actual removal to allow for fuzzy matching..):
    const originIds = new Set(inUnits.map(u => u.attr.id));
    let removeNodes = getUnits(destDoc, xliffVersion)!.filter(destUnit => !originIds.has(destUnit.attr.id));

    // add missing units and update existing ones:
    for (const unit of inUnits) {
        const destUnit = getDestUnit(unit, destUnitsParent, options?.fuzzyMatch ?? true ? removeNodes : []);
        const unitSource = getSourceElement(unit)!;
        const unitSourceText = toString(...unitSource.children);
        if (destUnit) {
            const destSource = getSourceElement(destUnit)!;
            const destSourceText = toString(...destSource.children);
            if (options?.collapseWhitespace ?? true ? collapseWhitespace(destSourceText) !== collapseWhitespace(unitSourceText) : destSourceText !== unitSourceText) {
                destSource.children = unitSource.children;
                if (options?.sourceLanguage || (options?.syncTargetsWithInitialState === true && isUntranslated(destUnit, xliffVersion, destSourceText))) {
                    getTargetElement(destUnit)!.children = unitSource.children;
                }
                updateFirstAndLastChild(destSource);
                resetTranslationState(destUnit, xliffVersion, options);
                console.debug(`update element with id "${unit.attr.id}" with new source: ${toString(...destSource.children)} (was: ${destSourceText})`);
            }
            if (destUnit.attr.id !== unit.attr.id) {
                console.debug(`matched unit with previous id "${destUnit.attr.id}" to new id: "${unit.attr.id}"`);
                removeNodes = removeNodes.filter(n => n !== destUnit);
                destUnit.attr.id = unit.attr.id;
                resetTranslationState(destUnit, xliffVersion, options);
            }
            // update notes (remark: there can be multiple context-groups!):
            const nodeName = xliffVersion === '2.0' ? 'notes' : 'context-group';
            const noteIndex = destUnit.children.findIndex(n => n.type === 'element' && n.name === nodeName);
            removeChildren(destUnit, ...destUnit.children.filter(n => n.type === 'element' && n.name === nodeName));
            const originNotes = unit.childrenNamed(nodeName) ?? [];
            destUnit.children.splice(noteIndex >= 0 ? noteIndex : destUnit.children.length - 1, 0, ...originNotes);
            updateFirstAndLastChild(destUnit);
        } else {
            console.debug(`adding element with id "${unit.attr.id}"`);
            if (options?.newTranslationTargetsBlank !== 'omit') {
                const targetNode = new XmlDocument(`<target>${options?.newTranslationTargetsBlank ?? false ? '' : unitSourceText}</target>`);
                if (xliffVersion === '2.0') {
                    const segmentSource = unit.childNamed('segment')!;
                    segmentSource.children.push(targetNode);
                } else {
                    const sourceIndex = unit.children.indexOf(unitSource);
                    unit.children.splice(sourceIndex + 1, 0, targetNode);
                }
            }
            resetTranslationState(unit, xliffVersion, options);
            destUnitsParent.children.push(unit);
            updateFirstAndLastChild(destUnitsParent);
        }
    }

    console.debug(`removing ${removeNodes.length} ids: ${removeNodes.map(n => n.attr.id).join(', ')}`);
    removeChildren(destUnitsParent, ...removeNodes);

    // retain xml declaration:
    const xmlDecMatch = destFileContent.match(/^<\?xml [^>]*>\s*/i);
    const xmlDeclaration = xmlDecMatch ? xmlDecMatch[0] : '';

    return xmlDeclaration + revertApostrophes(destDoc.toString({
        preserveWhitespace: true,
        compressed: true
    }), !options?.replaceApostrophe);
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
