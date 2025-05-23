/* eslint-disable no-console */
import '@loaders.gl/polyfills';
import {join} from 'path';
import inquirer from 'inquirer';
import {I3SConverter, Tiles3DConverter} from '@loaders.gl/tile-converter';
import {DepsInstaller} from './deps-installer/deps-installer';
import {
  getBooleanValue,
  getIntegerValue,
  getStringValue,
  getURLValue,
  validateOptionsWithEqual
} from './lib/utils/cli-utils';
import {addOneFile, composeHashFile, makeZipCDHeaderIterator} from '@loaders.gl/zip';
import {FileHandleFile} from '@loaders.gl/loader-utils';
// @ts-ignore
import {copyFile} from 'node:fs/promises';

type TileConversionOptions = {
  /** "I3S" - for I3S to 3DTiles conversion, "3DTILES" for 3DTiles to I3S conversion */
  inputType?: string;
  /** "tileset.json" file (3DTiles) / "http://..../SceneServer/layers/0" resource (I3S) */
  tileset?: string;
  /** Tileset name. This option is used for naming in resulting json resouces and for resulting path/*.slpk file naming */
  name?: string;
  /** Output folder. This folder will be created by converter if doesn't exist. It is relative to the converter path.
   * Default: "data" folder */
  output: string;
  /** 3DTiles version.
   * Default: version "1.1" */
  outputVersion?: string;
  /** Keep created 3DNodeIndexDocument files on disk instead of memory. This option reduces memory usage but decelerates conversion speed */
  instantNodeWriting: boolean;
  /** Try to merge similar materials to be able to merge meshes into one node (I3S to 3DTiles conversion only) */
  mergeMaterials: boolean;
  /** location of the Earth Gravity Model (*.pgm) file to convert heights from ellipsoidal to gravity-related format,
   * "None" for not using Earth Gravity Model (*.pgm)
   * default: "./deps/egm2008-5.pgm". A model file can be loaded from GeographicLib
   * https://geographiclib.sourceforge.io/html/geoid.html */
  egm: string;
  /** 3DTile->I3S only. Token for Cesium ION tileset authentication. */
  token?: string;
  /** 3DTiles->I3S only. Enable draco compression for geometry. Default: true */
  draco: boolean;
  /** Run the script for installing dependencies. Run this options separate from others. Now "*.pgm" file installation is
   * implemented */
  installDependencies: boolean;
  /** 3DTile->I3S only. Enable KTX2 textures generation if only one of (JPG, PNG) texture is provided or generate JPG texture
   * if only KTX2 is provided */
  generateTextures: boolean;
  /** 3DTile->I3S only. Will generate obb and mbs bounding volumes from geometry */
  generateBoundingVolumes: boolean;
  /** Validate the dataset during conversion. Validation messages will be posted in the console output */
  validate: boolean;
  /** Maximal depth of the hierarchical tiles tree traversal, default: infinite */
  maxDepth?: number;
  /** Adds a hash file to an .slpk without hash */
  addHash: boolean;
  /** Set feature metadata class from EXT_FEATURE_METADATA or EXT_STRUCTURAL_METADATA extensions  */
  metadataClass?: string;
  /** With this options the tileset content will be analyzed without conversion */
  analyze?: boolean;
  /** Skip all prompts that stop conversion and wait for a user input */
  quiet?: boolean;
};

/* During validation we check that particular options are defined so they can't be undefined */
type ValidatedTileConversionOptions = TileConversionOptions & {
  /** "I3S" - for I3S to 3DTiles conversion, "3DTILES" for 3DTiles to I3S conversion */
  inputType: string;
  /** "tileset.json" file (3DTiles) / "http://..../SceneServer/layers/0" resource (I3S) */
  tileset: string;
  /** Tileset name. This option is used for naming in resulting json resouces and for resulting path/*.slpk file naming */
  name: string;
};

const TILESET_TYPE = {
  I3S: 'I3S',
  _3DTILES: '3DTILES'
};

/**
 * CLI entry
 * @returns
 */
// eslint-disable-next-line max-statements
async function main() {
  const [, , ...args] = process.argv;

  if (args.length === 0) {
    printHelp();
  }

  const validatedOptionsArr = validateOptionsWithEqual(args);

  const options: TileConversionOptions = parseOptions(validatedOptionsArr);

  if (options.installDependencies) {
    const depthInstaller = new DepsInstaller();
    depthInstaller.install('deps');
    return;
  }

  if (options.addHash) {
    const validatedOptions = validateOptions(options, true);
    let finalPath = validatedOptions.tileset;

    if (!options.quiet) {
      if (validatedOptions.output === 'data') {
        const nameWithoutExt = validatedOptions.tileset.substring(
          0,
          validatedOptions.tileset.length - 5
        );

        const result = await inquirer.prompt<{isNewFileRequired: boolean}>([
          {
            name: 'isNewFileRequired',
            type: 'list',
            message: 'What would you like to do?',
            choices: [
              {
                name: 'Add hash file to the current SLPK file',
                value: false
              },
              {
                name: `Create a new file ${nameWithoutExt}-hash.slpk with hash file inside`,
                value: true
              }
            ]
          }
        ]);

        if (result.isNewFileRequired) {
          finalPath = `${nameWithoutExt}-hash.slpk`;
        }
      } else {
        finalPath = validatedOptions.output;
      }
    }

    if (finalPath !== validatedOptions.tileset) {
      await copyFile(validatedOptions.tileset, finalPath);
    }
    const hashTable = await composeHashFile(makeZipCDHeaderIterator(new FileHandleFile(finalPath)));
    await addOneFile(finalPath, hashTable, '@specialIndexFileHASH128@');

    return;
  }

  const validatedOptions: ValidatedTileConversionOptions = validateOptions(options);

  await convert(validatedOptions);
}

main().catch((error) => {
  console.log(error);
  process.exit(1); // eslint-disable-line no-process-exit
});

/**
 * Output for `npx tile-converter --help`
 */
function printHelp(): void {
  console.log('cli: converter 3dTiles to I3S or I3S to 3dTiles...');
  console.log(
    '--install-dependencies [Run the script for installing dependencies. Run this options separate from others. Now "*.pgm" file installation is implemented]'
  );
  console.log(
    '--max-depth [Maximal depth of hierarchical tiles tree traversal, default: infinite]'
  );
  console.log('--name [Tileset name]');
  console.log('--output [Output folder, default: "data" folder]');
  console.log(
    '--instant-node-writing [Keep created 3DNodeIndexDocument files on disk instead of memory. This option reduces memory usage but decelerates conversion speed]'
  );
  console.log(
    '--split-nodes [Prevent merging similar materials that could lead to incorrect visualization (I3S to 3DTiles conversion only)]'
  );
  console.log(
    '--slpk [(Deprecated since version 4.3.0) Whether the converter generates *.slpk (Scene Layer Package) I3S output files. Note: For versions 4.3.0 and up *.slpk is the default output without this option specified.]'
  );
  console.log(
    '--tileset [tileset.json file (3DTiles) / http://..../SceneServer/layers/0 resource (I3S)]'
  );
  console.log('--input-type [tileset input type: I3S or 3DTILES]');
  console.log(
    '--output-version [3DTiles version: 1.0 or 1.1, default: 1.1]. This option supports only 1.0/1.1 values for 3DTiles output. I3S output version setting is not supported yet.'
  );
  console.log(
    '--egm [location of Earth Gravity Model *.pgm file to convert heights from ellipsoidal to gravity-related format or "None" to not use it. A model file can be loaded from GeographicLib https://geographiclib.sourceforge.io/html/geoid.html], default: "./deps/egm2008-5.zip"'
  );
  console.log('--token [Token for Cesium ION tilesets authentication]');
  console.log('--no-draco [Disable draco compression for geometry]');
  console.log(
    '--generate-textures [Enable KTX2 textures generation if only one of (JPG, PNG) texture is provided or generate JPG texture if only KTX2 is provided]'
  );
  console.log('--generate-bounding-volumes [Generate obb and mbs bounding volumes from geometry]');
  console.log('--analyze [Analyze the input tileset content without conversion, default: false]');
  console.log(
    '--metadata-class [One of the list of feature metadata classes, detected by converter on "analyze" stage, default: not set]'
  );
  console.log('--validate [Enable validation]');
  console.log(
    '--quiet [Skip all prompts that stop conversion and wait for a user input: default: false]'
  );
  process.exit(0); // eslint-disable-line
}

/**
 * Run conversion process
 * @param options validated tile-converter options
 */
async function convert(options: ValidatedTileConversionOptions) {
  console.log(`------------------------------------------------`); // eslint-disable-line
  console.log(`Starting conversion of ${options.inputType}`); // eslint-disable-line
  console.log(`------------------------------------------------`); // eslint-disable-line
  const inputType = options.inputType.toUpperCase();
  switch (inputType) {
    case TILESET_TYPE.I3S:
      const tiles3DConverter = new Tiles3DConverter();
      await tiles3DConverter.convert({
        inputUrl: options.tileset,
        outputPath: options.output,
        outputVersion: options.outputVersion,
        tilesetName: options.name,
        maxDepth: options.maxDepth,
        egmFilePath: options.egm,
        analyze: options.analyze,
        inquirer: options.quiet ? undefined : inquirer
      });
      break;
    case TILESET_TYPE._3DTILES:
      const converter = new I3SConverter();
      await converter.convert({
        inputUrl: options.tileset,
        outputPath: options.output,
        tilesetName: options.name,
        maxDepth: options.maxDepth,
        egmFilePath: options.egm,
        token: options.token,
        draco: options.draco,
        mergeMaterials: options.mergeMaterials,
        generateTextures: options.generateTextures,
        generateBoundingVolumes: options.generateBoundingVolumes,
        validate: options.validate,
        instantNodeWriting: options.instantNodeWriting,
        metadataClass: options.metadataClass,
        analyze: options.analyze,
        inquirer: options.quiet ? undefined : inquirer
      });
      break;
    default:
      printHelp();
  }
}

// OPTIONS
/**
 * Validate input options of the CLI command
 * @param options - input options of the CLI command
 * @returns validated options
 */
function validateOptions(
  options: TileConversionOptions,
  addHash?: boolean
): ValidatedTileConversionOptions {
  const mandatoryOptionsWithExceptions: {
    [key: string]: {
      getMessage: () => void;
      condition?: (optionValue: any) => boolean;
    };
  } = {
    name: {
      getMessage: () => console.log('Missed: --name [Tileset name]'),
      condition: (value: any) => addHash || Boolean(value) || Boolean(options.analyze)
    },
    output: {getMessage: () => console.log('Missed: --output [Output path name]')},
    egm: {getMessage: () => console.log('Missed: --egm [*.pgm earth gravity model file path]')},
    tileset: {getMessage: () => console.log('Missed: --tileset [tileset.json file]')},
    inputType: {
      getMessage: () =>
        console.log('Missed/Incorrect: --input-type [tileset input type: I3S or 3DTILES]'),
      condition: (value) =>
        addHash || (Boolean(value) && Object.values(TILESET_TYPE).includes(value.toUpperCase()))
    },
    outputVersion: {
      getMessage: () =>
        console.log('Incorrect: --output-version [1.0 or 1.1] is for --input-type "I3S" only'),
      condition: (value) =>
        addHash ||
        (Boolean(value) &&
          Object.values(['1.0', '1.1']).includes(value) &&
          Boolean(options.inputType === 'I3S')) ||
        Boolean(options.inputType !== 'I3S') ||
        Boolean(options.analyze)
    }
  };
  const exceptions: (() => void)[] = [];
  for (const mandatoryOption in mandatoryOptionsWithExceptions) {
    const optionValue = options[mandatoryOption];

    const conditionFunc = mandatoryOptionsWithExceptions[mandatoryOption].condition;
    const testValue = conditionFunc ? conditionFunc(optionValue) : optionValue;

    if (!testValue) {
      exceptions.push(mandatoryOptionsWithExceptions[mandatoryOption].getMessage);
    }
  }
  if (exceptions.length) {
    exceptions.forEach((exeption) => exeption());
    process.exit(1); // eslint-disable-line no-process-exit
  }
  return <ValidatedTileConversionOptions>options;
}

/**
 * Parse option from the cli arguments array
 * @param args
 * @returns
 */
function parseOptions(args: string[]): TileConversionOptions {
  const opts: TileConversionOptions = {
    output: 'data',
    outputVersion: '1.1',
    instantNodeWriting: false,
    mergeMaterials: true,
    egm: join(process.cwd(), 'deps', 'egm2008-5.pgm'),
    draco: true,
    installDependencies: false,
    generateTextures: false,
    generateBoundingVolumes: false,
    validate: false,
    addHash: false,
    quiet: false
  };

  // eslint-disable-next-line complexity
  args.forEach((arg, index) => {
    if (arg.indexOf('--') === 0) {
      switch (arg) {
        case '--input-type':
          opts.inputType = getStringValue(index, args);
          break;
        case '--tileset':
          opts.tileset = getURLValue(index, args);
          break;
        case '--name':
          opts.name = getStringValue(index, args);
          break;
        case '--output':
          opts.output = getStringValue(index, args);
          break;
        case '--output-version':
          opts.outputVersion = getStringValue(index, args);
          break;
        case '--instant-node-writing':
          opts.instantNodeWriting = getBooleanValue(index, args);
          break;
        case '--split-nodes':
          opts.mergeMaterials = getBooleanValue(index, args);
          break;
        case '--max-depth':
          opts.maxDepth = getIntegerValue(index, args);
          break;
        case '--add-hash':
          opts.addHash = getBooleanValue(index, args);
          break;
        case '--egm':
          opts.egm = getStringValue(index, args);
          break;
        case '--token':
          opts.token = getStringValue(index, args);
          break;
        case '--no-draco':
          opts.draco = getBooleanValue(index, args);
          break;
        case '--validate':
          opts.validate = getBooleanValue(index, args);
          break;
        case '--install-dependencies':
          opts.installDependencies = getBooleanValue(index, args);
          break;
        case '--generate-textures':
          opts.generateTextures = getBooleanValue(index, args);
          break;
        case '--generate-bounding-volumes':
          opts.generateBoundingVolumes = getBooleanValue(index, args);
          break;
        case '--analyze':
          opts.analyze = getBooleanValue(index, args);
          break;
        case '--quiet':
          opts.quiet = getBooleanValue(index, args);
          break;
        case '--metadata-class':
          opts.metadataClass = getStringValue(index, args);
          break;
        case '--help':
          printHelp();
          break;
        // we need this option for backward compatibility
        // do nothing but don't throw the error
        case '--slpk':
          break;
        default:
          console.warn(`Unknown option ${arg}`);
          process.exit(0); // eslint-disable-line
      }
    }
  });
  return opts;
}
