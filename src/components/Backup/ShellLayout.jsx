import React from 'react';

/**
 * ShellLayout
 * Standardizes the outer panel wrapper used for cinematic panel transitions.
 * This replaces duplicated "panelStyle(active)" wrappers without changing logic.
 */
export default function ShellLayout({
  active,
  children,
  activeZ = 6,
  inactiveZ = 4,
  translateY = 10,
  transition = 'opacity 220ms ease, transform 220ms ease',
  style = {},
  ...rest
}) {
  const wrapperStyle = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0px)' : `translateY(${translateY}px)`,
    transition,
    pointerEvents: active ? 'auto' : 'none',
    zIndex: active ? activeZ : inactiveZ,
    ...style,
  };

  return (
    <div style={wrapperStyle} {...rest}>
      {children}
    </div>
  );
}
