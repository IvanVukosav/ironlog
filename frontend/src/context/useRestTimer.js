import { useContext } from "react";
import { RestTimerContext } from "./restTimerContextDefinition";

export function useRestTimer() {
  const context = useContext(RestTimerContext);
  if (!context) {
    throw new Error("useRestTimer must be used within a RestTimerProvider");
  }
  return context;
}
