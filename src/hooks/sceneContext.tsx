import React from 'react';
import { Scene } from 'three';

export const SceneContext: React.Context<Scene | Record<string, any>> = React.createContext({});
