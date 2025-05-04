"use client"

import React from 'react';
import styles from './loader.module.css';

interface LoaderProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
}

export function Loader({ text = 'Loading...', size = 'medium' }: LoaderProps) {
  return (
    <div className={styles.loaderContainer}>
      <div className={`${styles.spinner} ${styles[size]}`}></div>
      {text && <p className={styles.loaderText}>{text}</p>}
    </div>
  );
}
