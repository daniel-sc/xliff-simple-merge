[![npm](https://img.shields.io/npm/v/xliff-simple-merge)](https://www.npmjs.com/package/xliff-simple-merge)
[![Coverage Status](https://coveralls.io/repos/github/daniel-sc/xliff-simple-merge/badge.svg?branch=main)](https://coveralls.io/github/daniel-sc/xliff-simple-merge?branch=main)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/daniel-sc/xliff-simple-merge.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/daniel-sc/xliff-simple-merge/context:javascript)

# XLIFF Simple Merge

This program automates the merging of XLIFF files (version 1.2 and 2.0). 
New translations from the input file (e.g. "messages.xlf") are merged into the destination file (e.g "messages.fr-FR.xlf"), while keeping exising translations intact. 
Removed translations will be removed in the input file.

This can be used as post-processing to angular i18n extraction, to update translations files.

**Angular users**: It is recommended to _not_ use this program directly but the custom angular tooling: [ng-extract-i18n-merge](https://github.com/daniel-sc/ng-extract-i18n-merge)

## Usage

Either install via `npm i -g xliff-simple-merge` or run directly with `npx xliff-simple-merge`.

```text
Options:
  -i, --input-file <inputFiles...>          input file(s)/merge origin(s)
  -d, --destination-file <destinationFile>  merge destination
  -o, --output-file <outputFile>            output file, if not provided "merge destination" is overwritten
  -e, -exclude-file <excludeFiles...>       exclude all unit IDs of the provided file(s) 
  --no-match-fuzzy                          prevent fuzzy matching of similar units with changed id
  --no-collapse-whitespace                  prevent collapsing of multiple whitespaces when comparing translations sources
  --no-reset-translation-state              prevent (re-)setting the translation state to new/initial for new/changed units
  --no-replace-apostrophe                   prevent replacing of apostrophes (') with "&apos;"
  --debug                                   enable debug output
  -h, --help                                display help for command
```

### Notes
* If different input files contains the same unit IDs, only the latter ones will be used.
* The input file can have target defined in the units and if it is the case they will have priority.
