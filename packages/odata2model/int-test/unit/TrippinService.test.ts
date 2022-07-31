import { EditableLocationModel, EditablePersonModel, Feature, PersonGender } from "../../build/v4/trippin/TrippinModel";
import { qLocation, qPerson } from "../../build/v4/trippin/QTrippin";
import { TrippinService } from "../../build/v4/trippin/TrippinService";
import { MockODataClient } from "../MockODataClient";

describe("Testing Generation of TrippinService", () => {
  const BASE_URL = "/test";
  const odataClient = new MockODataClient();

  const testService = new TrippinService(odataClient, BASE_URL);

  let editModel: EditablePersonModel;

  beforeEach(() => {
    editModel = {
      UserName: "williams",
      FavoriteFeature: Feature.Feature1,
      Features: [],
      FirstName: "Heinz",
      Gender: PersonGender.Unknown,
    };
  });

  test("unbound function", async () => {
    await testService.getPersonWithMostFriends();
    expect(odataClient.lastUrl).toBe(`${BASE_URL}/GetPersonWithMostFriends()`);
  });

  test("unbound function with params", async () => {
    await testService.getNearestAirport({ lat: 123, lon: 345 });
    expect(odataClient.lastUrl).toBe(`${BASE_URL}/GetNearestAirport(lat=123,lon=345)`);
  });

  test("unbound action", async () => {
    await testService.resetDataSource();
    expect(odataClient.lastUrl).toBe(`${BASE_URL}/ResetDataSource`);
    expect(odataClient.lastData).toEqual({});
  });

  test("entitySet", async () => {
    const expected = `${BASE_URL}/People`;

    expect(testService.people.getPath()).toBe(expected);
    expect(JSON.stringify(testService.people.getQObject())).toEqual(JSON.stringify(qPerson));
    expect(testService.people.getKeySpec()).toEqual([
      { isLiteral: false, type: "string", name: "userName", odataName: "UserName" },
    ]);
  });

  test("entitySet: create", async () => {
    const expectedUrl = `${BASE_URL}/People`;

    await testService.people.create(editModel);

    expect(odataClient.lastOperation).toBe("POST");
    expect(odataClient.lastUrl).toBe(expectedUrl);
    expect(odataClient.lastData).toBe(editModel);
  });

  test("entitySet: get", async () => {
    const testId = "test";
    const expected = `${BASE_URL}/People('${testId}')`;

    const etService = testService.people.get(testId);

    expect(etService.getPath()).toBe(expected);
    expect(JSON.stringify(etService.getQObject())).toEqual(JSON.stringify(qPerson));
  });

  test("entitySet: get with complex id", async () => {
    const testId = { UserName: "williams" };
    const expected = `${BASE_URL}/People(UserName='williams')`;

    expect(testService.people.get(testId).getPath()).toBe(expected);
    expect(testService.people.get(editModel).getPath()).toBe(expected);
  });

  test("entityType: update", async () => {
    const id = "williams";
    const expectedUrl = `${BASE_URL}/People('${id}')`;
    const model: EditablePersonModel = {
      UserName: "williams",
      FavoriteFeature: Feature.Feature1,
      Features: [],
      FirstName: "Heinz",
      Gender: PersonGender.Unknown,
      Age: 33,
    };

    await testService.people.get(id).update(model);

    expect(odataClient.lastOperation).toBe("PUT");
    expect(odataClient.lastUrl).toBe(expectedUrl);
    expect(odataClient.lastData).toBe(model);
  });

  test("entityType: patch", async () => {
    const id = "williams";
    const expectedUrl = `${BASE_URL}/People('${id}')`;
    const model = {
      Age: 44,
    };

    await testService.people.get(id).patch(model);

    expect(odataClient.lastOperation).toBe("PATCH");
    expect(odataClient.lastUrl).toBe(expectedUrl);
    expect(odataClient.lastData).toBe(model);
  });

  test("entityType: delete", async () => {
    const id = "williams";
    const expectedUrl = `${BASE_URL}/People('${id}')`;

    await testService.people.get(id).delete();

    expect(odataClient.lastOperation).toBe("DELETE");
    expect(odataClient.lastUrl).toBe(expectedUrl);
    expect(odataClient.lastData).toBe(undefined);
  });

  test("complex type", async () => {
    const complex = testService.people.get("tester").homeAddress;

    expect(complex.getPath()).toBe(`${BASE_URL}/People('tester')/HomeAddress`);
    expect(JSON.stringify(complex.getQObject())).toEqual(JSON.stringify(qLocation));
  });

  test("complex type: query", async () => {
    await testService.people.get("tester").homeAddress.query();

    expect(odataClient.lastUrl).toBe(`${BASE_URL}/People('tester')/HomeAddress`);
    expect(odataClient.lastOperation).toBe("GET");
    expect(odataClient.lastData).toBeUndefined();
  });

  test("complex type: update", async () => {
    const complex = testService.people.get("tester").homeAddress;

    const model: EditableLocationModel = {
      Address: "Test Address",
      City: { Name: "Test City" },
    };
    await complex.update(model);

    expect(odataClient.lastOperation).toBe("PUT");
    expect(odataClient.lastUrl).toBe(`${BASE_URL}/People('tester')/HomeAddress`);
    expect(odataClient.lastData).toStrictEqual(model);
  });

  test("complex collection", async () => {
    const complex = testService.people.get("tester").addressInfo;

    expect(complex.getPath()).toBe(`${BASE_URL}/People('tester')/AddressInfo`);
    expect(JSON.stringify(complex.getQObject())).toEqual(JSON.stringify(qLocation));
  });

  test("complex collection: query", async () => {
    await testService.people.get("tester").addressInfo.query();

    expect(odataClient.lastUrl).toBe(`${BASE_URL}/People('tester')/AddressInfo`);
    expect(odataClient.lastOperation).toBe("GET");
    expect(odataClient.lastData).toBeUndefined();
  });

  test("complex collection: create", async () => {
    const model: EditableLocationModel = { Address: "TestAdress" };
    await testService.people.get("tester").addressInfo.add(model);

    expect(odataClient.lastUrl).toBe(`${BASE_URL}/People('tester')/AddressInfo`);
    expect(odataClient.lastOperation).toBe("POST");
    expect(odataClient.lastData).toEqual(model);
  });

  test("complex collection: update", async () => {
    const models = [{ Address: "TestAddress 1" }, { Address: "test 2" }];
    await testService.people.get("tester").addressInfo.update(models);

    expect(odataClient.lastUrl).toBe(`${BASE_URL}/People('tester')/AddressInfo`);
    expect(odataClient.lastOperation).toBe("PUT");
    expect(odataClient.lastData).toEqual(models);
  });

  test("complex collection: delete", async () => {
    await testService.people.get("tester").addressInfo.delete();

    expect(odataClient.lastUrl).toBe(`${BASE_URL}/People('tester')/AddressInfo`);
    expect(odataClient.lastOperation).toBe("DELETE");
    expect(odataClient.lastData).toBeUndefined();
  });

  test("navigation", async () => {
    const result = testService.people.get("tester").bestFriend.bestFriend.bestFriend.homeAddress.city;

    expect(result.getPath()).toBe(`${BASE_URL}/People('tester')/BestFriend/BestFriend/BestFriend/HomeAddress/City`);
  });

  test("singleton", async () => {
    const result = testService.me;

    expect(result.getPath()).toBe(`${BASE_URL}/Me`);
    expect(JSON.stringify(result.getQObject())).toEqual(JSON.stringify(qPerson));
  });
});
