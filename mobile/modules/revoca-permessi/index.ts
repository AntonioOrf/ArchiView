import { requireNativeModule } from 'expo';

type RevocaPermessi = {
  rinunciaFotocamera(): boolean;
};

export default requireNativeModule<RevocaPermessi>('RevocaPermessi');
