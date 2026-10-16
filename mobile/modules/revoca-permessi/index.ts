import { requireNativeModule } from 'expo-modules-core';

type RevocaPermessi = {
  rinunciaFotocamera(): boolean;
};

export default requireNativeModule<RevocaPermessi>('RevocaPermessi');
