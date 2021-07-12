import * as Y from "yjs";
import create from "zustand/vanilla";
import { arrayToYArray, objectToYMap, } from "./mapping";
import {
  getChangeList,
  patchSharedType,
  patchStore,
} from "./patching";

describe("getChangeList", () =>
{
  it(
    "Should create an empty array for two values that are identical.",
    () =>
    {
      expect(getChangeList({}, {})).toEqual([]);
    }
  );

  it.each([
    [
      {},
      { "foo": 1, },
      [ "add", "foo", 1 ]
    ],
    [
      [],
      [ 1 ],
      [ "add", 0, 1 ]
    ]
  ])(
    "Should create an add entry when b contains a new item. (#%#)",
    (a, b, change) =>
    {
      expect(getChangeList(a, b)).toContainEqual(change);
    }
  );

  it("Should create an update entry when b contains a new value.", () =>
  {
    expect(getChangeList( { "foo": 1, }, { "foo": 2, }))
      .toEqual([ [ "update", "foo", 2 ] ]);
  });

  it("Should create an add and delete entry when an array changes.", () =>
  {
    expect(getChangeList([ 1 ], [ 2 ]))
      .toContainEqual([ "delete", 0, undefined ]);

    expect(getChangeList([ 1 ], [ 2 ]))
      .toContainEqual([ "add", 0, 2 ]);
  });

  it(
    "Should create a delete entry when b is missing a value.",
    () =>
    {
      expect(getChangeList({ "foo": 1, }, {}))
        .toContainEqual([ "delete", "foo", undefined ]);
    }
  );

  it.each([
    [
      { "foo": { "bar": 1, }, },
      { "foo": { "bar": 2, }, },
      [ "pending", "foo", undefined ]
    ],
    [
      { "foo": [ 1 ], },
      { "foo": [ 1, 2 ], },
      [ "pending", "foo", undefined ]
    ],
    [
      [ { "foo": 1, "bar": 3, } ],
      [ { "foo": 2, "bar": 3, } ],
      [ "pending", 0, undefined ]
    ]
  ])(
    "Should create a pending entry when a and b have nested data. (#%#)",
    (a, b, change) =>
    {
      expect(getChangeList(a, b))
        .toContainEqual(change);
    }
  );

  it.each([
    [
      { "foo": 1, "bar": 2, },
      { "foo": 1, "bar": 3, },
      [ "none", "foo", 1 ]
    ],
    [
      [ 1, 3 ],
      [ 1, 2 ],
      [ "none", 0, 1 ]
    ]
  ])(
    "Should create a 'none' change when a field does not change. (#%#)",
    (a, b, change) =>
    {
      expect(getChangeList(a, b)).toContainEqual(change);
    }
  );
});

describe("patchSharedType", () =>
{
  let ydoc: Y.Doc = new Y.Doc();
  let ymap: Y.Map<any> = new Y.Map();

  beforeEach(() =>
  {
    ydoc = new Y.Doc();
    ymap = ydoc.getMap("tmp");
  });

  afterEach(() =>
  {
    ydoc.destroy();
  });

  it("Applies additions to maps.", () =>
  {
    ymap.set("state", objectToYMap({ }));
    patchSharedType(ymap.get("state"), { "foo": 1, });

    expect(ymap.get("state").get("foo")).toBe(1);
  });

  it("Applies updates to maps.", () =>
  {
    ymap.set("state", objectToYMap({ "foo": 1, }));
    patchSharedType(ymap.get("state"), { "foo": 2, });

    expect(ymap.get("state").get("foo")).toBe(2);
  });

  it("Applies deletes to maps.", () =>
  {
    ymap.set("state", objectToYMap({ "foo": 1, }));
    patchSharedType(ymap.get("state"), { });

    expect(Array.from(ymap.get("state").keys())).toEqual([]);
  });

  it("Applies additions to maps nested in maps.", () =>
  {
    ymap.set("state", objectToYMap({ "foo": { }, }));
    patchSharedType(ymap.get("state"), { "foo": { "bar": 2, }, });

    expect(ymap.get("state")
      .get("foo")
      .get("bar")).toBe(2);
  });

  it("Applies updates to maps nested in maps.", () =>
  {
    ymap.set("state", objectToYMap({ "foo": { "bar": 1, }, }));
    patchSharedType(ymap.get("state"), { "foo": { "bar": 2, }, });

    expect(ymap.get("state")
      .get("foo")
      .get("bar")).toBe(2);
  });

  it("Applies deletions to maps nested in maps.", () =>
  {
    ymap.set("state", objectToYMap({ "foo": { "bar": 1, }, }));
    patchSharedType(ymap.get("state"), { "foo": { }, });

    expect(Array.from(ymap.get("state")
      .get("foo")
      .keys())).toEqual([]);
  });

  it("Applies additions to arrays.", () =>
  {
    ymap.set("array", arrayToYArray([ ]));
    patchSharedType(ymap.get("array"), [ 1 ]);

    expect(ymap.get("array").get(0)).toBe(1);
  });

  it("Applies deletions to arrays.", () =>
  {
    ymap.set("array", arrayToYArray([ 1 ]));
    patchSharedType(ymap.get("array"), [ ]);

    expect(ymap.get("array").length).toBe(0);
  });

  it("Combines additions and deletions into updates for arrays", () =>
  {
    ymap.set("array", arrayToYArray([ 1 ]));
    patchSharedType(ymap.get("array"), [ 2, 3 ]);

    expect(ymap.get("array").get(0)).toBe(2);
    expect(ymap.get("array").get(1)).toBe(3);
  });

  it("Applies additions to arrays nested in arrays.", () =>
  {
    ymap.set("array", arrayToYArray([ 1, [ ] ]));
    patchSharedType(ymap.get("array"), [ 1, [ 2 ] ]);

    expect(ymap.get("array")
      .get(1)
      .get(0)).toBe(2);
  });

  it("Applies deletions to arrays nested in arrays.", () =>
  {
    ymap.set("array", arrayToYArray([ 1, [ 2, 3 ] ]));
    patchSharedType(ymap.get("array"), [ 1, [ 2 ] ]);

    expect(ymap.get("array").get(1)).toHaveLength(1);
  });

  it("Applies additions and deletions into updates for nested arrays.", () =>
  {
    ymap.set("array", arrayToYArray([ 1, [ 2, 3 ] ]));
    patchSharedType(ymap.get("array"), [ 1, [ 2, 4 ] ]);

    expect(ymap.get("array")
      .get(1)
      .get(1)).toBe(4);
  });

  it("Applies additions to arrays nested in objects.", () =>
  {
    ymap.set("map", objectToYMap({ "foo": [ 1, 2 ], }));
    patchSharedType(ymap.get("map"), { "foo": [ 1, 2, 3 ], });

    expect(ymap.get("map").get("foo")
      .get(2)).toBe(3);
  });

  it("Applies updates to arrays nested in objects.", () =>
  {
    ymap.set("map", objectToYMap({ "foo": [ 1, 2, 3 ], }));
    patchSharedType(ymap.get("map"), { "foo": [ 1, 4, 3 ], });

    expect(ymap.get("map").get("foo")
      .get(1)).toBe(4);
  });

  it("Applies deletions to arrays nested in objects.", () =>
  {
    ymap.set("map", objectToYMap({ "foo": [ 1, 2, 3 ], }));
    patchSharedType(ymap.get("map"), { "foo": [ 1, 2 ], });

    expect(ymap.get("map").get("foo")).toHaveLength(2);
  });

  it("Applies additions to objects nested in arrays.", () =>
  {
    ymap.set("array", arrayToYArray([ { "foo": 1, } ]));
    patchSharedType(ymap.get("array"), [ { "foo": 1, "bar": 2, } ]);

    expect(ymap.get("array").get(0)
      .get("bar")).toBe(2);
  });

  it("Applies updates to objects nested in arrays.", () =>
  {
    ymap.set("array", arrayToYArray([ { "foo": { "bar": 1, }, } ]));
    patchSharedType(ymap.get("array"), [ { "foo": { "bar": 2, }, } ]);

    expect(ymap.get("array")
      .get(0)
      .get("foo")
      .get("bar")).toBe(2);
  });

  it("Applies deletions to objects nested in arrays.", () =>
  {
    ymap.set("array", arrayToYArray([ { "foo": { "bar": 1, "baz": 2, }, } ]));
    patchSharedType(ymap.get("array"), [ { "foo": { "bar": 1, }, } ]);

    expect(ymap.get("array")
      .get(0)
      .get("foo")
      .get("baz")).toBeUndefined();
  });
});

describe("patchStore", () =>
{
  it("Applies additions to objects.", () =>
  {
    const store = create(() =>
      ({ }));

    const update = { "foo": 2, };

    patchStore(store, update);

    expect((store.getState() as { "foo": number, }).foo).toBe(2);
  });

  it("Applies updates to objects.", () =>
  {
    const store = create(() =>
      ({
        "foo": 1,
      }));

    const update = { "foo": 2, };

    patchStore(store, update);

    expect(store.getState().foo).toBe(2);
  });

  it("Applies deletions to objects.", () =>
  {
    const store = create(() =>
      ({
        "foo": 1,
      }));

    const update = { };

    patchStore(store, update);

    expect(store.getState().foo).toBeUndefined();
  });

  it("Applies additions to nested objects.", () =>
  {
    const store = create(() =>
      ({
        "foo": { },
      }));

    const update = {
      "foo": {
        "bar": 1,
      },
    };

    patchStore(store, update);

    expect((store.getState().foo as { "bar": number, }).bar).toBe(1);
  });

  it("Applies updates to nested objects.", () =>
  {
    const store = create(() =>
      ({
        "foo": { "bar": 2, },
      }));

    const update = {
      "foo": {
        "bar": 3,
      },
    };

    patchStore(store, update);

    expect(store.getState().foo.bar).toBe(3);
  });

  it("Applies deletions to nested objects.", () =>
  {
    const store = create(() =>
      ({
        "foo": { "bar": 2, },
      }));

    const update = {
      "foo": { },
    };

    patchStore(store, update);

    expect(store.getState().foo.bar).toBeUndefined();
  });

  it("Applies additions to arrays.", () =>
  {
    const store = create(() =>
      ({
        "foo": [ ],
      }));

    const update = {
      "foo": [ 1 ],
    };

    patchStore(store, update);

    expect(store.getState().foo[0]).toBe(1);
  });

  it("Applies deletions to arrays.", () =>
  {
    const store = create(() =>
      ({
        "foo": [ 1 ],
      }));

    const update = {
      "foo": [ ],
    };

    patchStore(store, update);

    expect(store.getState().foo[0]).toBeUndefined();
  });

  it("Combines additions and deletions as updates to arrays.", () =>
  {
    const store = create(() =>
      ({
        "foo": [ 1, 3, 3 ],
      }));

    const update = {
      "foo": [ 1, 2, 3 ],
    };

    patchStore(store, update);

    expect(store.getState().foo[1]).toBe(2);
  });
});