import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import { errorMessage } from "./errorMessages";

const hr = i18n.getFixedT("hr");
const en = i18n.getFixedT("en");
const error = (message) => new Error(message);

describe("errorMessage", () => {
  it("says the server's messages in Croatian, with their numbers", () => {
    expect(errorMessage(error("Reps must be a whole number of 0 or more"), hr)).toBe(
      "Ponavljanja moraju biti cijeli broj, 0 ili više.",
    );
    expect(errorMessage(error("RPE must be between 1 and 10"), hr)).toBe(
      "RPE mora biti od 1 do 10.",
    );
    expect(errorMessage(error("Weeks must be between 1 and 52"), hr)).toBe(
      "Program može imati od 1 do 52 tjedna.",
    );
    expect(errorMessage(error("Exercise template already exists"), hr)).toBe("To ime već postoji.");
  });

  it("names a lost connection, whichever browser words it", () => {
    for (const message of [
      "Failed to fetch",
      "NetworkError when attempting to fetch resource.",
      "Load failed",
    ]) {
      expect(errorMessage(new TypeError(message), hr)).toBe(
        "Nema veze sa serverom. Provjeri internet.",
      );
    }
  });

  it("keeps a message nobody listed, after words that something failed", () => {
    expect(errorMessage(error("exerciseIds must be an array"), hr)).toBe(
      "Nešto nije uspjelo: exerciseIds must be an array",
    );
    expect(errorMessage(error("Request failed with status 502"), en)).toBe(
      "The request failed (502).",
    );
  });
});
