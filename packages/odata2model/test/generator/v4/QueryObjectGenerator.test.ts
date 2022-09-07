import { ODataTypesV4 } from "../../../lib/data-model/edmx/ODataEdmxModelV4";
import { ODataVesions } from "../../../src/app";
import { digest } from "../../../src/data-model/DataModelDigestionV4";
import { ODataTypesV3 } from "../../../src/data-model/edmx/ODataEdmxModelV3";
import { generateQueryObjects } from "../../../src/generator";
import { GenerationOptions } from "../../../src/OptionModel";
import { ODataModelBuilderV4 } from "../../data-model/builder/v4/ODataModelBuilderV4";
import {
  EntityBasedGeneratorFunctionWithoutVersion,
  FixtureComparatorHelper,
  createHelper,
} from "../comparator/FixtureComparatorHelper";
import { SERVICE_NAME } from "../v2/EntityBasedGenerationTests";
import { ENTITY_NAME, createEntityBasedGenerationTests } from "./EntityBasedGenerationTests";

describe("Query Object Generator Tests V4", () => {
  const TEST_SUITE_NAME = "Query Object Generator";
  const FIXTURE_BASE_PATH = "generator/qobject";

  const GENERATE: EntityBasedGeneratorFunctionWithoutVersion = (dataModel, sourceFile, options) => {
    return generateQueryObjects(dataModel, sourceFile, ODataVesions.V4, options);
  };

  let odataBuilder: ODataModelBuilderV4;
  let fixtureComparatorHelper: FixtureComparatorHelper;

  createEntityBasedGenerationTests(TEST_SUITE_NAME, FIXTURE_BASE_PATH, GENERATE);

  async function generateAndCompare(id: string, fixturePath: string, genOptions?: GenerationOptions) {
    await fixtureComparatorHelper.generateAndCompare(id, fixturePath, odataBuilder.getSchema(), genOptions);
  }

  beforeAll(async () => {
    fixtureComparatorHelper = await createHelper(FIXTURE_BASE_PATH, digest, GENERATE);
  });

  beforeEach(() => {
    odataBuilder = new ODataModelBuilderV4(SERVICE_NAME);
  });

  test(`${TEST_SUITE_NAME}: min QFunction`, async () => {
    // given a simple function
    odataBuilder.addFunction("MinFunction", ODataTypesV4.String, false, (builder) =>
      builder.addParam("test", ODataTypesV4.String, false).addParam("optTest", ODataTypesV4.String, true)
    );

    // when generating model
    // then match fixture text
    await generateAndCompare("minFunction", "function-min.ts");
  });

  test(`${TEST_SUITE_NAME}: max QFunction`, async () => {
    // given a function
    odataBuilder.addFunction("MAX_FUNCTION", ODataTypesV4.String, false, (builder) =>
      builder
        .addParam("TEST_STRING", ODataTypesV4.String, false)
        .addParam("testNumber", ODataTypesV4.Int32, false)
        .addParam("testBoolean", ODataTypesV4.Boolean, false)
        .addParam("testGuid", ODataTypesV4.Guid, false)
        .addParam("testTime", ODataTypesV4.Time, false)
        .addParam("testDate", ODataTypesV4.Date, false)
        .addParam("testDateTimeOffset", ODataTypesV4.DateTimeOffset, false)
    );

    // when generating model
    // then match fixture text
    await generateAndCompare("maxFunction", "function-max.ts");
  });

  test(`${TEST_SUITE_NAME}: bound QFunction`, async () => {
    // given one minimal model with bound function
    odataBuilder
      .addEntityType(ENTITY_NAME, undefined, (builder) => builder.addKeyProp("id", ODataTypesV4.Boolean))
      .addFunction("MinFunction", ODataTypesV4.String, true, (builder) =>
        builder
          .addParam("book", `${SERVICE_NAME}.Book`)
          .addParam("test", ODataTypesV4.String, false)
          .addParam("optTest", ODataTypesV4.String, true)
      );

    // when generating model
    // then match fixture text
    await generateAndCompare("boundFunc", "function-bound.ts");
  });

  test(`${TEST_SUITE_NAME}: min QAction`, async () => {
    // given a simple function
    odataBuilder.addAction("MinAction", ODataTypesV4.String, false, (builder) =>
      builder.addParam("test", ODataTypesV4.String, false).addParam("optTest", ODataTypesV4.String, true)
    );

    // when generating model
    // then match fixture text
    await generateAndCompare("minAction", "action-min.ts");
  });
});
