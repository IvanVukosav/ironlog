import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { useSettings } from "../context/useSettings";
import { useToast } from "../context/useToast";
import { fetchBestE1rms } from "../hooks/useBestE1rms";
import { useReportError } from "../hooks/useReportError";
import { formatPercent } from "../utils/numbers";
import { DEFAULT_E1RM_FORMULA } from "../utils/oneRepMax";
import { exportProgramToExcel } from "../utils/programExport";
import Icon from "../components/Icon";
import ProgramEditor from "../components/ProgramEditor";
import styles from "./Programs.module.css";

const NEW_PROGRAM = "new";

function Programs() {
  const { t, i18n } = useTranslation();
  const { showSuccess } = useToast();
  const reportError = useReportError();
  // Null until the programs have loaded, so "no programs yet" does not flash first.
  const [programs, setPrograms] = useState(null);
  const [exerciseNames, setExerciseNames] = useState([]);
  const [editingId, setEditingId] = useState(null);
  // The program being made into an Excel file, while it is.
  const [exportingId, setExportingId] = useState(null);
  const { settings } = useSettings();

  useEffect(() => {
    fetchJson("/api/programs").then(setPrograms).catch(reportError);

    fetchJson("/api/exercise-templates")
      .then((data) => setExerciseNames(data.map((template) => template.name)))
      .catch(reportError);
  }, [reportError]);

  const saveProgram = (body) => {
    const isNew = editingId === NEW_PROGRAM;
    fetchJson(isNew ? "/api/programs" : `/api/programs/${editingId}`, {
      method: isNew ? "POST" : "PUT",
      json: body,
    })
      .then((saved) => {
        setPrograms((prev) =>
          [...(prev ?? []).filter((program) => program.id !== saved.id), saved].sort(
            (programA, programB) => programA.name.localeCompare(programB.name),
          ),
        );
        setEditingId(null);
        showSuccess(t("programs.saved"));
      })
      .catch(reportError);
  };

  const deleteProgram = (program) => {
    if (!window.confirm(t("programs.confirmDelete", { name: program.name }))) return;
    fetchJson(`/api/programs/${program.id}`, { method: "DELETE" })
      .then(() => setPrograms((prev) => prev.filter((other) => other.id !== program.id)))
      .catch(reportError);
  };

  // The program as an Excel file, its weights worked out from today's best e1RMs.
  const exportProgram = async (program) => {
    setExportingId(program.id);
    try {
      const e1rms = await fetchBestE1rms(settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA);
      await exportProgramToExcel(program, { e1rms, t, language: i18n.language });
    } catch (error) {
      reportError(error);
    } finally {
      setExportingId(null);
    }
  };

  // "4 tjedna · 3 dana · TM 90 %"
  const summary = (program) =>
    [
      t("programs.weekCount", { count: program.weeks }),
      t("programs.dayCount", { count: program.days.length }),
      t("programs.trainingMaxShort", {
        percent: formatPercent(program.trainingMaxPercent, i18n.language),
      }),
    ].join(" · ");

  if (editingId !== null) {
    return (
      <div className={`${styles.page} ${styles.editingPage}`}>
        <div className={styles.editorHeader}>
          <button type="button" className={styles.backButton} onClick={() => setEditingId(null)}>
            <Icon name="chevronLeft" size={18} />
            {t("nav.programs")}
          </button>
          <h1 className={styles.heading}>
            {editingId === NEW_PROGRAM ? t("programs.newProgram") : t("programs.editProgram")}
          </h1>
        </div>
        <ProgramEditor
          program={programs?.find((program) => program.id === editingId)}
          exerciseNames={exerciseNames}
          onSave={saveProgram}
          onCancel={() => setEditingId(null)}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>{t("nav.programs")}</h1>
        <button
          type="button"
          className={styles.newButton}
          onClick={() => setEditingId(NEW_PROGRAM)}
        >
          <Icon name="plus" size={18} />
          {t("programs.newProgram")}
        </button>
      </div>
      <p className={styles.intro}>{t("programs.intro")}</p>

      {programs?.length === 0 && <p className={styles.empty}>{t("programs.empty")}</p>}
      {programs?.length > 0 && (
        <ul className={styles.list}>
          {programs.map((program) => (
            <li key={program.id} className={styles.programCard}>
              <div className={styles.programHeader}>
                <h2 className={styles.programName}>{program.name}</h2>
                <div className={styles.programActions}>
                  <button
                    type="button"
                    className={styles.editButton}
                    onClick={() => setEditingId(program.id)}
                  >
                    {t("programs.edit")}
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => deleteProgram(program)}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
              <p className={styles.programMeta}>{summary(program)}</p>
              <ul className={styles.days}>
                {program.days.map((day) => (
                  <li key={day.dayNumber} className={styles.dayChip}>
                    {day.name || t("programs.dayNumber", { number: day.dayNumber })}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={styles.exportButton}
                onClick={() => exportProgram(program)}
                disabled={exportingId !== null}
              >
                <Icon name="download" size={16} />
                {exportingId === program.id ? t("programs.exporting") : t("programs.exportExcel")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Programs;
