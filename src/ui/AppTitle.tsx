export function AppTitle({ modeTitle }: { modeTitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 6,
          background: "rgba(255,255,255,0.22)",
        }}
      />
      <div style={{ fontWeight: 700, fontSize: 13 }}>Search-Do</div>

      {modeTitle && (
        <div
          style={{
            marginLeft: 6,
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            opacity: 0.9,
          }}
        >
          {modeTitle}
        </div>
      )}
    </div>
  );
}
