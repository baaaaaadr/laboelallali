import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LabStatus {
  isOpen: boolean;
  nextChangeTime: Date | null;
  countdownText: string;
  statusText: string;
  isClient: boolean; // Track if we're on client side
}

export const useLabStatus = (): LabStatus => {
  const { t } = useTranslation('common');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isClient, setIsClient] = useState(false);

  // Set client-side flag
  useEffect(() => {
    setIsClient(true);
    // Set initial time on client
    setCurrentTime(new Date());
  }, []);

  // Update current time every minute (only on client)
  useEffect(() => {
    if (!isClient) return;
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [isClient]);

  // Lab opening hours configuration
  const getLabHours = (dayOfWeek: number) => {
    if (dayOfWeek === 0) {
      // Sunday: 8:00 - 18:00
      return { open: 8, close: 18 };
    } else {
      // Monday-Saturday: 7:30 - 18:30
      return { open: 7.5, close: 18.5 };
    }
  };

  // Calculate lab status and countdown
  const calculateLabStatus = (): LabStatus => {
    const now = currentTime;
    const currentDay = now.getDay();
    const currentHours = now.getHours() + now.getMinutes() / 60;
    
    const todayHours = getLabHours(currentDay);
    const isCurrentlyOpen = currentHours >= todayHours.open && currentHours < todayHours.close;
    
    let nextChangeTime: Date | null = null;
    let countdownText = '';
    
    // Only calculate countdown on client side to prevent hydration mismatch
    if (isClient) {
      if (isCurrentlyOpen) {
        // Lab is open - calculate time until closing
        const closeTime = new Date(now);
        const closeHour = Math.floor(todayHours.close);
        const closeMinute = (todayHours.close % 1) * 60;
        closeTime.setHours(closeHour, closeMinute, 0, 0);
        
        nextChangeTime = closeTime;
        
        // Calculate time difference
        const timeDiff = closeTime.getTime() - now.getTime();
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
          countdownText = `${t('closes_in')} ${hours}${t('hours_short')}${minutes.toString().padStart(2, '0')}${t('minutes_short')}`;
        } else {
          countdownText = `${t('closes_in')} ${minutes}${t('minutes_short')}`;
        }
      } else {
        // Lab is closed - calculate time until next opening
        let nextOpenTime = new Date(now);
        let nextDay = currentDay;
        
        // If it's before opening time today, open today
        if (currentHours < todayHours.open) {
          const openHour = Math.floor(todayHours.open);
          const openMinute = (todayHours.open % 1) * 60;
          nextOpenTime.setHours(openHour, openMinute, 0, 0);
        } else {
          // Otherwise, open next day
          nextDay = (currentDay + 1) % 7;
          nextOpenTime.setDate(nextOpenTime.getDate() + 1);
          
          const nextDayHours = getLabHours(nextDay);
          const openHour = Math.floor(nextDayHours.open);
          const openMinute = (nextDayHours.open % 1) * 60;
          nextOpenTime.setHours(openHour, openMinute, 0, 0);
        }
        
        nextChangeTime = nextOpenTime;
        
        // Calculate time difference
        const timeDiff = nextOpenTime.getTime() - now.getTime();
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
          countdownText = `${t('opens_in')} ${hours}${t('hours_short')}${minutes.toString().padStart(2, '0')}${t('minutes_short')}`;
        } else {
          countdownText = `${t('opens_in')} ${minutes}${t('minutes_short')}`;
        }
      }
    }
    
    const statusText = isCurrentlyOpen ? t('open') : t('closed');
    
    return {
      isOpen: isCurrentlyOpen,
      nextChangeTime,
      countdownText,
      statusText,
      isClient
    };
  };

  return calculateLabStatus();
};