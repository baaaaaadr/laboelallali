import { useTranslation } from 'react-i18next';
import { getLabOpeningStatus } from '@/constants/labHours';
import { useNow } from '@/hooks/useNow';

interface LabStatus {
  /** Meaningless while `isClient` is false — check `isClient` before showing it. */
  isOpen: boolean;
  nextChangeTime: Date | null;
  countdownText: string;
  statusText: string;
  /** True once the status has been computed in the browser. */
  isClient: boolean;
}

/**
 * Live "laboratoire ouvert / fermé" status.
 *
 * Nothing is computed during the server render — see `useNow` for why. Until
 * the browser has mounted, `isClient` is false and every consumer must render a
 * neutral placeholder rather than `isOpen`, otherwise a stale "Ouvert" baked
 * into the prerendered HTML can stay on screen indefinitely.
 */
export const useLabStatus = (): LabStatus => {
  const { t } = useTranslation('common');
  const currentTime = useNow();

  if (!currentTime) {
    return {
      isOpen: false,
      nextChangeTime: null,
      countdownText: '',
      statusText: '',
      isClient: false,
    };
  }

  const { isOpen, minutesUntilChange, nextChangeTime } = getLabOpeningStatus(currentTime);

  const hours = Math.floor(minutesUntilChange / 60);
  const minutes = minutesUntilChange % 60;
  const prefix = isOpen ? t('closes_in') : t('opens_in');
  const countdownText =
    hours > 0
      ? `${prefix} ${hours}${t('hours_short')}${minutes.toString().padStart(2, '0')}${t('minutes_short')}`
      : `${prefix} ${minutes}${t('minutes_short')}`;

  return {
    isOpen,
    nextChangeTime,
    countdownText,
    statusText: isOpen ? t('open') : t('closed'),
    isClient: true,
  };
};
