import {XmlDocument, XmlElement, XmlNode} from 'xmldoc';
import levenshtein from 'js-levenshtein';

type MergeOptions = { fuzzyMatch?: boolean, collapseWhitespace?: boolean, resetTranslationState?: boolean, replaceApostrophe?: boolean };

const FUZZY_THRESHOLD = 0.2;

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

function resetTranslationState(destUnit: XmlElement, xliffVersion: '1.2' | '2.0', options?: MergeOptions) {
    if (options?.resetTranslationState ?? true) {
        if (xliffVersion === '2.0') {
            destUnit.childNamed('segment')!.attr.state = 'initial';
        } else {
            destUnit.childNamed('target')!.attr.state = 'new';
        }
    }
}

function revertApostrophes(s: string, revertApos: boolean): string {
    return revertApos ? s.replace(/&apos;/g, '\'') : s;
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

    // add missing units:
    for (const unit of inUnits) {
        const destUnit = getDestUnit(unit, destUnitsParent, options?.fuzzyMatch ?? true ? removeNodes : []);
        const unitSource = getSourceElement(unit)!;
        const unitSourceText = toString(...unitSource.children);
        if (destUnit) {
            const destSource = getSourceElement(destUnit)!;
            const destSourceText = toString(...destSource.children);
            if (options?.collapseWhitespace ?? true ? collapseWhitespace(destSourceText) !== collapseWhitespace(unitSourceText) : destSourceText !== unitSourceText) {
                destSource.children = unitSource.children;
                destSource.firstChild = destSource.children[0];
                destSource.lastChild = destSource.children[destSource.children.length - 1];
                resetTranslationState(destUnit, xliffVersion, options);
                console.debug(`update element with id "${unit.attr.id}" with new source: ${toString(...destSource.children)} (was: ${destSourceText})`);
            }
            if (destUnit.attr.id !== unit.attr.id) {
                console.debug(`matched unit with previous id "${destUnit.attr.id}" to new id: "${unit.attr.id}"`);
                removeNodes = removeNodes.filter(n => n !== destUnit);
                destUnit.attr.id = unit.attr.id;
                resetTranslationState(destUnit, xliffVersion, options);
            }
        } else {
            console.debug(`adding element with id "${unit.attr.id}"`);
            if (xliffVersion === '2.0') {
                const segmentSource = unit.childNamed('segment')!;
                segmentSource.children.push(new XmlDocument(`<target>${unitSourceText}</target>`));
            } else {
                const sourceIndex = unit.children.indexOf(unitSource);
                unit.children.splice(sourceIndex + 1, 0, new XmlDocument(`<target>${unitSourceText}</target>`));
            }
            resetTranslationState(unit, xliffVersion, options);
            destUnitsParent.children.push(unit);
            destUnitsParent.lastChild = destUnitsParent.children[destUnitsParent.children.length - 1];
        }
    }

    console.debug(`removing ${removeNodes.length} ids: ${removeNodes.map(n => n.attr.id).join(', ')}`);
    removeChildren(destUnitsParent, ...removeNodes);

    // retain xml declaration:
    const xmlDecMatch = destFileContent.match(/^<\?xml .*[^>]\s*/i);
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
    node.firstChild = node.children[0];
    node.lastChild = node.children[node.children.length - 1];
}

function isWhiteSpace(node: XmlNode): boolean {
    return node.type === 'text' && !!node.text.match(/^\s*$/);
}
