import { requireNativeModule } from 'expo-modules-core';

type RevocaPermessi = {
  /** true: Android ritira il permesso alla chiusura dell'app (13+); false: va tolto a mano. */
  rinunciaFotocamera(): boolean;
};

export default requireNativeModule<RevocaPermessi>('RevocaPermessi');
