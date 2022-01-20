import {XmlDocument, XmlElement, XmlNode} from 'xmldoc';


function getDestUnit(originUnit: XmlElement, destUnitsParent: XmlElement) {
    // TODO fuzzy match if id not found
    return destUnitsParent.childWithAttribute('id', originUnit.attr['id']);
}

function toString(...nodes: XmlNode[]): string {
    return nodes.map(n => n.toString({preserveWhitespace: true, compressed: true})).join('');
}

export function merge(inFileContent: string, destFileContent: string) {
    const inDoc = new XmlDocument(inFileContent);
    const destDoc = new XmlDocument(destFileContent);
    const inFileElement = inDoc.childNamed('file')!;
    const destFileElement = destDoc.childNamed('file')!;

    // add missing units:
    for (const unit of inFileElement.childrenNamed('unit') ?? []) {
        const destUnit = getDestUnit(unit, destFileElement);
        const unitSource = unit.childNamed('segment')!.childNamed('source')!;
        const unitSourceText = toString(...unitSource.children);
        if (destUnit) {
            const destSource = destUnit.childNamed('segment')!.childNamed('source')!;
            const destSourceText = toString(...destSource.children);
            if (destSourceText !== unitSourceText) {
                destSource.children = unitSource.children;
                destSource.firstChild = destSource.children[0];
                destSource.lastChild = destSource.children[destSource.children.length - 1];
                destUnit.childNamed('segment')!.attr['state'] = 'initial'; // reset translation state, as source changed // TODO configurable?
                console.debug(`update element with id "${unit.attr['id']}" wit new source: ${toString(...destSource.children)} (was: ${destSourceText})`);
            }
        } else {
            console.debug(`adding element with id "${unit.attr['id']}"`);
            // formatting assumes 2 spaces indentation:
            const newElement = new XmlDocument(`<unit id="${unit.attr['id']}">
      <segment state="initial">
        <source>${unitSourceText}</source>
        <target>${unitSourceText}</target>
      </segment>
    </unit>`);
            destFileElement.children.push(newElement); // known: formatting not optimal (missing new line..)
            destFileElement.lastChild = destFileElement.children[destFileElement.children.length - 1];
        }
    }

    // remove obsolete units:
    const originIds = new Set(inFileElement.childrenNamed('unit').map(u => u.attr['id']));
    const removeNodes = destFileElement.childrenNamed('unit').filter(destUnit => !originIds.has(destUnit.attr['id']));
    console.debug(`removing ${removeNodes.length} ids: ${removeNodes.map(n => n.attr['id']).join(', ')}`);
    removeChildren(destFileElement, ...removeNodes);

    // retain xml declaration:
    const xmlDecMatch = destFileContent.match(/^<\?xml .*[^>]\s*/i);
    const xmlDeclaration = xmlDecMatch ? xmlDecMatch[0] : '';

    return xmlDeclaration + destDoc.toString({preserveWhitespace: true, compressed: true});
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
    if (node.children.length === 1 && isWhiteSpace(node.children[0])) {
        node.children = [];
    }
    node.firstChild = node.children[0];
    node.lastChild = node.children[node.children.length - 1];
}

function isWhiteSpace(node: XmlNode): boolean {
    return node.type === 'text' && !!node.text.match(/^\s*$/);
}
