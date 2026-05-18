export default function AdminToggle({ mode, onToggle }) {
  const isAdminMode = mode === "admin";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isAdminMode}
      aria-label={isAdminMode ? "Przełącz na admina" : "Przełącz na użytkownika"}
      title={isAdminMode ? "Tryb administratora" : "Tryb użytkownika"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0.45rem 0.75rem",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.45)",
        background: "rgba(255,255,255,0.12)",
        color: "#fff",
        cursor: "pointer",
        fontSize: "0.85rem",
        fontWeight: 600,
      }}
    >
      {
        !isAdminMode ? (
          <span role="img" aria-label="Admin">
            👩‍💼
          </span>
        ) : 
        (<span>Użytkownik</span>)
      }
      
      
    </button>
  );
}
