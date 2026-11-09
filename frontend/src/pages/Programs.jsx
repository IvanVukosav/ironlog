import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import ProgramEditor from "../components/ProgramEditor";
import styles from "./Programs.module.css";

const NEW_PROGRAM = "new";

function Programs() {
  const { t } = useTranslation();
  const { showError, showSuccess } = useToast();
  const [programs, setPrograms] = useState([]);
  const [exerciseNames, setExerciseNames] = useState([]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchJson("/api/programs")
      .then((data) => setPrograms(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson("/api/exercise-templates")
      .then((data) => setExerciseNames(data.map((template) => template.name)))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [showError]);

  const saveProgram = (body) => {
    const isNew = editingId === NEW_PROGRAM;
    fetchJson(isNew ? "/api/programs" : `/api/programs/${editingId}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((saved) => {
        setPrograms((prev) =>
          [...prev.filter((program) => program.id !== saved.id), saved].sort((programA, programB) =>
            programA.name.localeCompare(programB.name),
          ),
        );
        setEditingId(null);
        showSuccess(t("programs.saved"));
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const deleteProgram = (program) => {
    if (!window.confirm(t("programs.confirmDelete", { name: program.name }))) return;
    fetchJson(`/api/programs/${program.id}`, { method: "DELETE" })
      .then(() => setPrograms((prev) => prev.filter((other) => other.id !== program.id)))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  if (editingId !== null) {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>
          {editingId === NEW_PROGRAM ? t("programs.newProgram") : t("programs.editProgram")}
        </h1>
        <ProgramEditor
          program={programs.find((program) => program.id === editingId)}
          exerciseNames={exerciseNames}
          onSave={saveProgram}
          onCancel={() => setEditingId(null)}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("nav.programs")}</h1>
      <p className={styles.intro}>{t("programs.intro")}</p>

      <button type="button" className={styles.newButton} onClick={() => setEditingId(NEW_PROGRAM)}>
        {t("programs.newProgram")}
      </button>

      <div className={styles.list}>
        {programs.map((program) => (
          <div key={program.id} className={styles.programCard}>
            <div>
              <h2 className={styles.programName}>{program.name}</h2>
              <p className={styles.programMeta}>
                {t("programs.summary", {
                  weeks: program.weeks,
                  days: program.days.length,
                  trainingMax: program.trainingMaxPercent,
                })}
              </p>
              <p className={styles.programDays}>
                {program.days
                  .map((day) => day.name || t("programs.dayNumber", { number: day.dayNumber }))
                  .join(" · ")}
              </p>
            </div>
            <div className={styles.programActions}>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => setEditingId(program.id)}
              >
                {t("programs.edit")}
              </button>
              <button
                type="button"
                className={styles.dimButton}
                onClick={() => deleteProgram(program)}
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        ))}
        {programs.length === 0 && <p className={styles.empty}>{t("programs.empty")}</p>}
      </div>
    </div>
  );
}

export default Programs;
