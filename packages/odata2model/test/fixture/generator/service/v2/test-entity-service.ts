import { ODataClient } from "@odata2ts/odata-client-api";
import { EntityTypeServiceV2, EntitySetServiceV2 } from "@odata2ts/odata-service";
// @ts-ignore
import { TestEntity } from "../TesterModel";
// @ts-ignore
import { QTestEntity, qTestEntity } from "../QTester";

export class TestEntityService extends EntityTypeServiceV2<TestEntity, QTestEntity> {
  constructor(client: ODataClient, path: string) {
    super(client, path, qTestEntity);
  }
}

export class TestEntityCollectionService extends EntitySetServiceV2<
  TestEntity,
  QTestEntity,
  string | { id: string },
  TestEntityService
> {
  constructor(client: ODataClient, path: string) {
    super(client, path, qTestEntity, TestEntityService, [{ isLiteral: false, name: "id", odataName: "id" }]);
  }
}
