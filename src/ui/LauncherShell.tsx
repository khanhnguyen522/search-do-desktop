import React from "react";

export function LauncherShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",

        background: "rgba(18, 18, 20, 0.68)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",

        boxShadow: "0 14px 40px rgba(0,0,0,0.40)", // 👈 shadow nhẹ hơn
        border: "1px solid rgba(255,255,255,0.08)", // 👈 border dịu hơn
      }}
    >
      {/* ✅ gradient overlay để nhìn premium */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.00) 55%, rgba(0,0,0,0.20) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          padding: 18,
          fontFamily: "system-ui",
          color: "white",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}
