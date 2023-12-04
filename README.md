# apisetu-archive

Git based archive for all the API Setu specifications. This gets the latest version of the specification from the API Setu website and stores it in a git repository. This repository can be used to track changes in the specification.

[GitHub Actions](./.github/workflows/) are used to run the scripts every 24 hours.

## Install

```bash
npm install
```

## Run
```bash
node downloadResults.js # To download the registry and store them in a local registry - results.json
node downloadSpec.v2.js # To download the specifications for individual API collections
```

## Progress
The local registry is also updated only if there is a change in the registry at API Set to reduce network calls.
The progress of the download can be seen [here](./progress.json). Only the updated specs are downloaded.

## Watch YAML files
```bash
watch -n 5 'ls yaml_files | wc -l'
```

## How to use

Spefication in the [yaml](./yaml_files/)