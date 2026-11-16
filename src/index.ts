import * as xb from 'xrblocks';
import {BattleScene} from './BattleScene.ts';
import {mountBattleOverlay} from './overlay/BattleOverlay.tsx';

document.addEventListener('DOMContentLoaded', () => {
  mountBattleOverlay();

  const options = new xb.Options();
  options.setAppTitle('Kanto Arena 3D');
  options.setAppDescription(
    'Generation 1 Pokémon 3D Battle Arena — Pick your Kanto lead and battle in AR or VR.'
  );
  options.enableReticles();
  options.enableXRTransitions();
  options.xrButton.showEnterSimulatorButton = true;

  xb.add(new BattleScene());
  void xb.init(options);
});
