import React from 'react';
import { FiAlertCircle, FiInfo, FiLoader } from 'react-icons/fi';

const VARIANT_STYLES = {
  info: {
    container: 'border-brand/20 bg-glacier',
    icon: 'text-brand',
    title: 'text-deep',
    message: 'text-ink',
    Icon: FiInfo,
  },
  loading: {
    container: 'border-brand/20 bg-glacier',
    icon: 'text-brand',
    title: 'text-deep',
    message: 'text-ink',
    Icon: FiLoader,
  },
  error: {
    container: 'border-ember/30 bg-ember-soft',
    icon: 'text-ember',
    title: 'text-red-900',
    message: 'text-ember',
    Icon: FiAlertCircle,
  },
};

/**
 * Reserved status area that keeps voting-booth layout stable.
 * Content can change, but the slot height stays consistent.
 */
export default function VoterStatusSlot({
  variant = 'info',
  title,
  message,
  visible = true,
  className = '',
}) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.info;
  const Icon = styles.Icon;
  const isLoading = variant === 'loading';

  return (
    <div
      className={`mb-6 min-h-[5.5rem] rounded-lg border p-4 ${
        visible ? styles.container : 'border-transparent bg-transparent'
      } ${className}`}
      role={visible ? 'status' : undefined}
      aria-live={visible ? 'polite' : undefined}
      aria-hidden={!visible}
    >
      <div
        className={`flex h-full items-start transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Icon
          className={`mr-3 mt-0.5 h-5 w-5 flex-shrink-0 ${styles.icon} ${
            isLoading ? 'animate-spin' : ''
          }`}
        />
        <div className="min-w-0">
          {title ? (
            <h4 className={`font-medium ${styles.title}`}>{title}</h4>
          ) : null}
          {message ? (
            <p className={`text-sm ${title ? 'mt-1' : ''} ${styles.message}`}>
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
