"use client"

import { useRef, useEffect } from 'react'
import { Navbar, DocumentHistory, DocumentPanel, StixInspector } from '@/components'
import styles from './layout.module.css'

export default function Home() {
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  
  useEffect(() => {
    const rightSidebar = rightSidebarRef.current;
    const resizeHandle = resizeHandleRef.current;
    
    if (!rightSidebar || !resizeHandle) return;
    
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      const startX = e.clientX;
      const sidebarWidth = rightSidebar.getBoundingClientRect().width;
      
      const onMouseMove = (e: MouseEvent) => {
        if (!isResizingRef.current) return;
        
        const currentX = e.clientX;
        const deltaX = startX - currentX;
        const newWidth = Math.min(600, Math.max(200, sidebarWidth + deltaX));
        
        rightSidebar.style.width = `${newWidth}px`;
      };
      
      const onMouseUp = () => {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
    
    resizeHandle.addEventListener('mousedown', onMouseDown);
    
    return () => {
      resizeHandle.removeEventListener('mousedown', onMouseDown);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);
  
  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        {/* Left Sidebar - Document History */}
        <div className={styles.leftSidebar}>
          <DocumentHistory />
        </div>
        
        {/* Center Panel - Document Viewer + Chat */}
        <div className={styles.center}>
          <DocumentPanel />
        </div>
        
        {/* Right Sidebar - STIX Bundle Inspector */}
        <div className={styles.rightSidebar} ref={rightSidebarRef}>
          <div className={styles.resizeHandle} ref={resizeHandleRef}></div>
          <StixInspector />
        </div>
      </main>
    </div>
  )
}
