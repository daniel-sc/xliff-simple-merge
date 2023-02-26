#!/usr/bin/env node

import {Command} from 'commander';
import fs from 'fs';
import {merge} from './merge';

const options = new Command()
    .requiredOption('-i, --input-file <inputFiles...>', 'input file(s)/merge origin(s)')
    .requiredOption('-d, --destination-file <destinationFile>', 'merge destination')
    .option('-o, --output-file <outputFile>', 'output file, if not provided "merge destination" is overwritten')
    .option('-e, --exclude-file <excludeFiles...>', 'exclude all unit ids of the provided file(s)')
    .option('--no-match-fuzzy', 'prevent fuzzy matching of similar units with changed id')
    .option('--no-collapse-whitespace', 'prevent collapsing of multiple whitespaces and trimming when comparing translations sources')
    .option('--no-reset-translation-state', 'prevent (re-)setting the translation state to new/initial for new/changed units')
    .option('--no-replace-apostrophe', 'prevent replacing of apostrophes (\') with "&apos;"')
    .option('--debug', 'enable debug output')
    .parse()
    .opts();

if (!options.debug) {
    console.debug = () => null;
}

const inFilesContent = (options.inputFiles as string[]).map(inputFile => fs.readFileSync(inputFile, {encoding: 'utf8'}));
const destFileContent = fs.existsSync(options.destinationFile) ?  fs.readFileSync(options.destinationFile, {encoding: 'utf8'}) : '';

const outString = merge(inFilesContent, destFileContent, {
    excludeFiles: options.excludeFiles,
    fuzzyMatch: options.matchFuzzy,
    collapseWhitespace: options.collapseWhitespace,
    resetTranslationState: options.resetTranslationState,
    replaceApostrophe: options.replaceApostrophe,
}, options.destinationFile);

fs.writeFileSync(options.outputFile ?? options.destinationFile, outString, {encoding: 'utf8'});
