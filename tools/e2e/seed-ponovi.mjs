// Seeds the test backend (:3002) for "Ponovi trening": a program whose next day shows on Početna,
// and past workouts (one from the program) with warm-ups, a drop set and a superset. Nothing today.
export const API = "http://localhost:3002";
const pad = (value) => String(value).padStart(2, "0");
const key = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const now = new Date();
export const daysAgo = (n) => key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
export const today = daysAgo(0);

export async function api(path, method = "GET", json) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : undefined,
    body: json ? JSON.stringify(json) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

const set = (weight, reps, extra = {}) => ({ weight, reps, ...extra });
const warm = (weight, reps) => set(weight, reps, { isWarmup: true });

export async function seed() {
  for (const workout of await api("/api/workouts?limit=1000")) {
    await api(`/api/workouts/${workout.id}`, "DELETE");
  }
  for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
  const program = await api("/api/programs", "POST", {
    name: "5/3/1",
    weeks: 4,
    days: [
      { name: "Mrtvo dan", exercises: [{ name: "Mrtvo dizanje", weekSchemes: ["3x5@160kg", "", "", ""] }] },
      {
        name: "Čučanj dan",
        exercises: [
          { name: "Čučanj", weekSchemes: ["3x5@140kg", "", "", ""] },
          { name: "Bench press", weekSchemes: ["3x5@100kg", "", "", ""] },
        ],
      },
    ],
  });

  const add = async (date, name, exercises, programDay) => {
    const workout = await api("/api/workouts", "POST", { date, name });
    await api(`/api/workouts/${workout.id}/exercises/bulk`, "POST", { exercises, program: programDay });
    await api(`/api/workouts/${workout.id}/finish`, "POST", {});
    return workout;
  };

  await add(daysAgo(6), "Mrtvo dan", [{ name: "Mrtvo dizanje", sets: [set(160, 5), set(160, 5), set(160, 5)] }], {
    id: program.id,
    week: 1,
    day: 1,
  });
  const push = await add(daysAgo(5), "Push", [
    { name: "Bench press", sets: [warm(60, 8), warm(80, 3), set(100, 5, { rpe: 8 }), set(100, 5, { rpe: 8.5 }), set(100, 5, { rpe: 9 })] },
    { name: "Overhead press", sets: [set(50, 8), set(50, 8), set(50, 7, { rpe: 9 })] },
    { name: "Triceps na sajli", supersetGroup: "A", sets: [set(30, 12), set(30, 12), set(30, 12), set(20, 10, { isDrop: true })] },
    { name: "Lateralno podizanje", supersetGroup: "A", sets: [set(10, 15), set(10, 15), set(10, 14)] },
  ]);
  await add(daysAgo(3), "Noge", [
    { name: "Čučanj", sets: [warm(60, 5), set(140, 5, { rpe: 8 }), set(140, 5, { rpe: 8 })] },
    { name: "Rumunjsko mrtvo", sets: [set(120, 8), set(120, 8)] },
  ]);
  await add(daysAgo(1), "Pull", [
    { name: "Zgibovi", sets: [set(10, 8), set(10, 7)] },
    { name: "Veslanje šipkom", sets: [set(80, 10), set(80, 10)] },
  ]);
  return { program, push };
}
