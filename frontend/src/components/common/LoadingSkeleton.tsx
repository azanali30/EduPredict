import React from 'react';

export const LoadingSkeleton: React.FC<{ height?: string; width?: string; borderRadius?: string }> = ({
  height = '20px',
  width = '100%',
  borderRadius = '0.375rem',
}) => {
  return (
    <div
      className="animate-pulse bg-slate-200"
      style={{
        height,
        width,
        borderRadius,
      }}
    />
  );
};
