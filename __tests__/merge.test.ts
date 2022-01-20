import {merge} from '../src/merge';
import {XmlDocument} from 'xmldoc';

describe('merge', () => {
    test('should add missing node', () => {
        const sourceFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source val</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '    <unit id="ID2">\n' +
            '      <segment>\n' +
            '        <source>source val2</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';
        const destFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="translated">\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';

        const result = merge(sourceFileContent, destFileContent);

        expect(norm(result)).toEqual(norm('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="translated">\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  <unit id="ID2">\n' +
            '      <segment state="initial">\n' +
            '        <source>source val2</source>\n' +
            '        <target>source val2</target>\n' +
            '      </segment>\n' +
            '    </unit></file>\n' +
            '</xliff>'));
    });

    test('should remove obsolete node', () => {
        const sourceFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source val</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';
        const destFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="translated">\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '    <unit id="ID2">\n' +
            '      <segment state="initial">\n' +
            '        <source>source val2</source>\n' +
            '        <target>source val2</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';

        const result = merge(sourceFileContent, destFileContent);

        expect(norm(result)).toEqual(norm('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="translated">\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>'));
    });

    test('should update changed node', () => {
        const sourceFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>new source val</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';
        const destFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="translated">\n' +
            '        <source>source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';

        const result = merge(sourceFileContent, destFileContent);

        expect(norm(result)).toEqual(norm('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="initial">\n' +
            '        <source>new source val</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>'));
    });

    test('should fuzzy match changed node', () => {
        const sourceFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>new source val that is long enough</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';
        const destFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="random-id">\n' +
            '      <segment state="translated">\n' +
            '        <source>source val that is long enough</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';

        const result = merge(sourceFileContent, destFileContent);

        expect(norm(result)).toEqual(norm('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="initial">\n' +
            '        <source>new source val that is long enough</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>'));
    });

    test('should ignore whitespace changes', () => {
        const sourceFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source    end</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';
        const destFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="translated">\n' +
            '        <source>source end</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';

        const result = merge(sourceFileContent, destFileContent);

        expect(norm(result)).toEqual(norm('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="translated">\n' +
            '        <source>source end</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>'));
    });

    test('should not ignore whitespace changes with option collapseWhitespace=false', () => {
        const sourceFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment>\n' +
            '        <source>source    end</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';
        const destFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="translated">\n' +
            '        <source>source end</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';

        const result = merge(sourceFileContent, destFileContent, {collapseWhitespace: false});

        expect(norm(result)).toEqual(norm('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <segment state="initial">\n' +
            '        <source>source    end</source>\n' +
            '        <target>target val</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>'));
    });
    test('should retain notes', () => {
        const sourceFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <notes>\n' +
            '        <note category="location">D:/Localization/Angular/Bugs/Icu/src/app/app.component.ts:2</note>\n' +
            '      </notes>' +
            '      <segment>\n' +
            '        <source>source text</source>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>';
        const destFileContent = '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '  </file>\n' +
            '</xliff>';

        const result = merge(sourceFileContent, destFileContent);

        expect(norm(result)).toEqual(norm('<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="fr-CH">\n' +
            '  <file original="ng.template" id="ngi18n">\n' +
            '    <unit id="ID1">\n' +
            '      <notes>\n' +
            '        <note category="location">D:/Localization/Angular/Bugs/Icu/src/app/app.component.ts:2</note>\n' +
            '      </notes>\n' +
            '      <segment state="initial">\n' +
            '        <source>source text</source>\n' +
            '        <target>source text</target>\n' +
            '      </segment>\n' +
            '    </unit>\n' +
            '  </file>\n' +
            '</xliff>'));
    });
});

function norm(xml: string): string {
    return new XmlDocument(xml).toString({compressed: true, preserveWhitespace: false});
}