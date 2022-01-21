[![npm](https://img.shields.io/npm/v/xliff-simple-merge)](https://www.npmjs.com/package/xliff-simple-merge)
[![Coverage Status](https://coveralls.io/repos/github/daniel-sc/xliff-simple-merge/badge.svg?branch=main)](https://coveralls.io/github/daniel-sc/xliff-simple-merge?branch=main)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/daniel-sc/xliff-simple-merge.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/daniel-sc/xliff-simple-merge/context:javascript)

# XLIFF Simple Merge

This program automates the merging of XLIFF files (version 1.2 and 2.0). 
New translations from the input file (e.g. "messages.xlf") are merged into the destination file (e.g "messages.fr-FR.xlf"), while keeping exising translations intact. 
Removed translations will be removed in the input file.

This can be used as post-processing to angular i18n extraction, to update translations files.

## Usage

Either install via `npm i -g xliff-simple-merge` or run directly with `npx xliff-simple-merge`.

```text
Options:
  -i, --input-file <inputFile>              input file/merge origin
  -d, --destination-file <destinationFile>  merge destination
  -o, --output-file <outputFile>            output file, if not provided "merge destination" is overwritten
  --no-match-fuzzy                          prevent fuzzy matching of similar units with changed id
  --no-collapse-whitespace                  prevent collapsing of multiple whitespaces and trimming when comparing translations sources
  --debug                                   enable debug output
  -h, --help                                display help for command
```
