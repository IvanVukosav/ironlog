import Icon from "./Icon";
import styles from "./PreviewTiles.module.css";

/**
 * One choice out of several, each a small picture of how it looks with its name under it:
 * Postavke's themes and templates. `options` are { value, label }; `preview(value)` draws one.
 */
function PreviewTiles({ label, options, value, onChange, preview }) {
  return (
    <div className={styles.tiles} role="group" aria-label={label}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={styles.tile}
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.frame}>
              {preview(option.value)}
              {isSelected && (
                <span className={styles.check}>
                  <Icon name="check" size={12} />
                </span>
              )}
            </span>
            <span className={styles.name}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The app in miniature in a theme's own colours (index.css gives each theme an attribute): a
 * heading, and a card with text and a button. "auto" is Graphite and Daylight cut across.
 */
export function ThemePreview({ theme }) {
  if (theme === "auto") {
    return (
      <span className={styles.split}>
        <ThemePreview theme="graphite" />
        <ThemePreview theme="daylight" />
      </span>
    );
  }
  return (
    <span className={styles.screen} data-theme={theme} aria-hidden="true">
      <span className={styles.heading} />
      <span className={styles.card}>
        <span className={styles.line} />
        <span className={styles.cardFoot}>
          <span className={styles.shortLine} />
          <span className={styles.button} />
        </span>
      </span>
    </span>
  );
}

// A card in a template's own shape, font and button, in the colours of the page.
export function TemplatePreview({ template }) {
  return (
    <span className={styles.screen} data-template={template} aria-hidden="true">
      <span className={styles.templateCard}>
        <span className={styles.templateText}>Aa</span>
        <span className={styles.templateButton}>OK</span>
      </span>
    </span>
  );
}

export default PreviewTiles;
