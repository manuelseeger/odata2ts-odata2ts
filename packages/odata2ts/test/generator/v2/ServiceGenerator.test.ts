import path from "path";

import { ODataTypesV2, ODataVersions } from "@odata2ts/odata-core";

import { EmitModes, RunOptions } from "../../../src";
import { digest } from "../../../src/data-model/DataModelDigestionV2";
import { NamingHelper } from "../../../src/data-model/NamingHelper";
import { generateServices } from "../../../src/generator";
import { ProjectManager, createProjectManager } from "../../../src/project/ProjectManager";
import { ODataModelBuilderV2 } from "../../data-model/builder/v2/ODataModelBuilderV2";
import { getTestConfig } from "../../test.config";
import { FixtureComparator, createFixtureComparator } from "../comparator/FixtureComparator";
import { SERVICE_NAME } from "./EntityBasedGenerationTests";

describe("Service Generator Tests V2", () => {
  const FIXTURE_PATH = "generator/service";

  let runOptions: Omit<RunOptions, "source" | "output">;
  let odataBuilder: ODataModelBuilderV2;
  let projectManager: ProjectManager;
  let fixtureComparator: FixtureComparator;

  function withNs(name: string) {
    return `${SERVICE_NAME}.${name}`;
  }

  beforeAll(async () => {
    fixtureComparator = await createFixtureComparator(FIXTURE_PATH);
  });

  beforeEach(async () => {
    odataBuilder = new ODataModelBuilderV2(SERVICE_NAME);
    runOptions = getTestConfig();
  });

  async function doGenerate() {
    const namingHelper = new NamingHelper(runOptions, SERVICE_NAME);
    projectManager = await createProjectManager(namingHelper.getFileNames(), "build", EmitModes.ts, true);
    const dataModel = await digest(odataBuilder.getSchemas(), runOptions, namingHelper);

    await generateServices(dataModel, projectManager, ODataVersions.V2, namingHelper, runOptions);
  }

  async function compareMainService(fixture: string) {
    const main = projectManager.getMainServiceFile();

    expect(main).toBeTruthy();
    expect(main.getFullText()).toBeTruthy();

    await fixtureComparator.compareWithFixture(main.getFullText(), "v2" + path.sep + fixture);
  }

  test("Service Generator: empty", async () => {
    // given nothing in particular

    // when generating
    await doGenerate();

    // then main service file has been generated but no individual ones
    await compareMainService("min.ts");
  });

  test("Service Generator: one EntitySet", async () => {
    // given one EntitySet
    odataBuilder
      .addEntityType("TestEntity", undefined, (builder) =>
        builder
          .addKeyProp("id", ODataTypesV2.Guid)
          .addKeyProp("age", ODataTypesV2.Int32)
          .addKeyProp("deceased", ODataTypesV2.Boolean)
          .addKeyProp("desc", ODataTypesV2.String)
          .addKeyProp("dateAndTime", ODataTypesV2.DateTime)
          .addKeyProp("dateAndTimeAndOffset", ODataTypesV2.DateTimeOffset)
          .addKeyProp("time", ODataTypesV2.Time)
          // simple props don't make a difference
          .addProp("test", ODataTypesV2.String)
      )
      .addEntitySet("Ents", withNs("TestEntity"));

    // when generating
    runOptions.enablePrimitivePropertyServices = true;
    await doGenerate();

    // then main service file lists an entity set
    await compareMainService("one-entityset.ts");
  });

  test("Service Generator: one function", async () => {
    // given three functions: one without and one with params and a third which POSTs
    odataBuilder
      .addEntityType("TestEntity", undefined, (builder) => builder.addKeyProp("id", ODataTypesV2.String))
      .addFunctionImport("MostPop", `Collection(${withNs("TestEntity")})`)
      .addFunctionImport("BEST_BOOK", withNs("TestEntity"), (builder) =>
        builder.addParam("TestString", ODataTypesV2.String, false).addParam("TEST_NUMBER", ODataTypesV2.Int32)
      )
      .addFunctionImport(
        "postBestBook",
        withNs("TestEntity"),
        (builder) =>
          builder.addParam("TestString", ODataTypesV2.String, false).addParam("TEST_NUMBER", ODataTypesV2.Int32),
        true
      );
    // when generating
    await doGenerate();

    // then main service file encompasses unbound functions
    await compareMainService("function-import.ts");
  });

  test("Service Generator: Special function params", async () => {
    // given two functions: one without and one with params
    odataBuilder
      .addEntityType("TestEntity", undefined, (builder) => builder.addKeyProp("id", ODataTypesV2.String))
      .addFunctionImport("bestBook", `Collection(${withNs("TestEntity")})`, (builder) =>
        builder
          .addParam("testGuid", ODataTypesV2.Guid, false)
          .addParam("testDateTime", ODataTypesV2.DateTime)
          .addParam("testDateTimeOffset", ODataTypesV2.DateTimeOffset)
          .addParam("testTime", ODataTypesV2.Time)
      );

    // when generating
    await doGenerate();

    // then main service file encompasses unbound functions
    await compareMainService("function-import-special-params.ts");
  });

  test("Service Generator: Entity Relationships", async () => {
    // given one EntitySet
    odataBuilder
      .addEntityType("Author", undefined, (builder) =>
        builder.addKeyProp("ID", ODataTypesV2.Guid).addProp("name", ODataTypesV2.String, false)
      )
      .addEntityType("Book", undefined, (builder) =>
        builder
          .addKeyProp("ID", ODataTypesV2.Guid)
          .addProp("author", withNs("Author"))
          .addProp("relatedAuthors", `Collection(${withNs("Author")})`)
      );

    // when generating
    runOptions.enablePrimitivePropertyServices = true;
    await doGenerate();

    await compareMainService("entity-relationships.ts");
  });

  test("Service Generator: Complex Type", async () => {
    // given one EntitySet
    odataBuilder
      .addComplexType("Reviewer", undefined, (builder) => builder.addProp("name", ODataTypesV2.String, false))
      .addEntityType("Book", undefined, (builder) =>
        builder
          .addKeyProp("id", ODataTypesV2.String)
          .addProp("lector", withNs("Reviewer"))
          .addProp("reviewers", `Collection(${withNs("Reviewer")})`)
      );

    // when generating
    await doGenerate();

    // then we get two additional service file
    await compareMainService("complex-type.ts");
    // "v2" + path.sep + "test-complex-service.ts"
  });

  test("Service Generator: EntityService with Enum Type", async () => {
    // given one EntitySet
    odataBuilder
      .addEnumType("Choice", [
        { name: "A", value: 1 },
        { name: "B", value: 2 },
      ])
      .addEntityType("Book", undefined, (builder) =>
        builder
          .addKeyProp("id", ODataTypesV2.String)
          .addProp("myChoice", withNs("Choice"))
          .addProp("altChoices", `Collection(${withNs("Choice")})`)
      );

    // when generating
    await doGenerate();

    // then we get two additional service file
    await compareMainService("enum-type.ts");
  });

  test("Service Generator: Entity Hierarchy", async () => {
    // given one EntitySet
    odataBuilder
      .addEntityType("GrandParent", undefined, (builder) => builder.addKeyProp("id", ODataTypesV2.Boolean))
      .addEntityType("Parent", withNs("GrandParent"), (builder) =>
        builder.addProp("parentalAdvice", ODataTypesV2.Boolean)
      )
      .addEntityType("Child", withNs("Parent"), (builder) =>
        builder.addKeyProp("id2", ODataTypesV2.Boolean).addProp("Ch1ld1shF4n", ODataTypesV2.Boolean)
      );

    // when generating
    await doGenerate();

    // then we get two additional service file
    await compareMainService("entity-hierarchy.ts");
  });
});
