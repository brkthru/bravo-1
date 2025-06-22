import React from 'react';

interface BravoLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'light' | 'dark';
}

export default function BravoLogo({ className = '', size = 'md', theme = 'light' }: BravoLogoProps) {
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  return (
    <svg
      className={`${sizeMap[size]} ${className}`}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Main gradient */}
        <linearGradient id="bravoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={theme === 'dark' ? '#60a5fa' : '#3b82f6'} />
          <stop offset="100%" stopColor={theme === 'dark' ? '#a78bfa' : '#6366f1'} />
        </linearGradient>
        
        {/* Accent gradient */}
        <linearGradient id="accentDot" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={theme === 'dark' ? '#f59e0b' : '#f97316'} />
          <stop offset="100%" stopColor={theme === 'dark' ? '#ef4444' : '#dc2626'} />
        </linearGradient>
      </defs>
      
      {/* Clean, modern B shape */}
      <path
        d="M 20 15 L 20 85 L 45 85 C 65 85 80 75 80 60 C 80 48 72 40 60 38 C 70 36 75 28 75 20 C 75 8 65 15 45 15 L 20 15 Z M 35 28 L 45 28 C 53 28 60 31 60 38 C 60 45 53 48 45 48 L 35 48 L 35 28 Z M 35 60 L 45 60 C 55 60 65 63 65 70 C 65 77 55 72 45 72 L 35 72 L 35 60 Z"
        fill="url(#bravoGradient)"
        className="filter drop-shadow-md"
      />
      
      {/* Dynamic accent dot */}
      <circle cx="85" cy="15" r="5" fill="url(#accentDot)">
        <animate
          attributeName="r"
          values="5;7;5"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.8;1;0.8"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}