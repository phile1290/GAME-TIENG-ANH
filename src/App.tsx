import React, { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { ClassroomGameView } from './components/ClassroomGame/ClassroomGameView';
import { TeacherDashboard } from './components/TeacherDashboard/TeacherDashboard';
import { hydrateStorageFromServer } from './services/classroomStorageService';

export default function App() {
  const { viewMode, hydrateFromPersistentStorage } = useGameStore();

  useEffect(() => {
    hydrateFromPersistentStorage();
    hydrateStorageFromServer().then((restored) => {
      if (restored) {
        hydrateFromPersistentStorage();
      }
    });
  }, [hydrateFromPersistentStorage]);

  return viewMode === 'dashboard' ? <TeacherDashboard /> : <ClassroomGameView />;
}
