'use client';

import React, { useState, useEffect } from 'react';

export function FundingCountdown() {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const nextFunding = new Date(now);
      const utcHours = now.getUTCHours();
      const nextEpochHour = (Math.floor(utcHours / 4) + 1) * 4;
      nextFunding.setUTCHours(nextEpochHour, 0, 0, 0);

      let diff = nextFunding.getTime() - now.getTime();
      if (diff <= 0) diff += 4 * 3600 * 1000;

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span className="font-mono font-bold text-cyan-300">{timeLeft}</span>;
}
