import assert from "assert";
import { 
  TestHelpers,
  Registry_AuthorityUpdated
} from "generated";
const { MockDb, Registry } = TestHelpers;

describe("Registry contract AuthorityUpdated event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for Registry contract AuthorityUpdated event
  const event = Registry.AuthorityUpdated.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("Registry_AuthorityUpdated is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await Registry.AuthorityUpdated.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualRegistryAuthorityUpdated = mockDbUpdated.entities.Registry_AuthorityUpdated.get(
      `${event.chainId}_${event.block.number}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedRegistryAuthorityUpdated: Registry_AuthorityUpdated = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      authority: event.params.authority,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualRegistryAuthorityUpdated, expectedRegistryAuthorityUpdated, "Actual RegistryAuthorityUpdated should be the same as the expectedRegistryAuthorityUpdated");
  });
});
