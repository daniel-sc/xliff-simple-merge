#!/usr/bin/env node

import {Command} from 'commander';
import fs from 'fs';
import {merge} from './merge';

/*
Assumptions:
- all units have an id

 */

const options = new Command()
    .requiredOption('-i, --input-file <inputFile>', 'input file/merge origin')
    .requiredOption('-d, --destination-file <destinationFile>', 'merge destination')
    .option('-o, --output-file <outputFile>', 'output file, if not provided "merge destination" is overwritten')
    .option('--debug', 'enable debug output')
    .parse()
    .opts();

if (!options.debug) {
    console.debug = () => null;
}

const inFileContent = fs.readFileSync(options.inputFile, {encoding: 'utf8'});
const destFileContent = fs.readFileSync(options.destinationFile, {encoding: 'utf8'});

const outString = merge(inFileContent, destFileContent);

fs.writeFileSync(options.outputFile ?? options.destinationFile, outString, {encoding: 'utf8'});
