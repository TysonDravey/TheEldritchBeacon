'use client';

interface WardProps {
  size: number;
}

export default function Ward({ size }: WardProps) {
  return (
    <img
      src="/svg/ward_sigil.svg"
      width={size}
      height={size}
      alt="Ward"
      style={{ opacity: 0.6 }}
      draggable={false}
    />
  );
}
