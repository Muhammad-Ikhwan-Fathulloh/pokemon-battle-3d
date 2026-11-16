import * as THREE from 'three';
import * as xb from 'xrblocks';
import {
  getTypeEffectiveness,
  POKEMON_LIST,
  TYPE_COLORS,
  type BattlePokemon,
} from '../pokemonData.ts';

export type DeckMode = 'main' | 'moves' | 'bag' | 'switch' | 'busy';

export interface BagInventory {
  superPotion: number;
  fullRestore: number;
  xAttack: number;
}

export interface BattleUICallbacks {
  onSelectLead(speciesId: string): void;
  onStartBattle(): void;
  onSelectMove(moveIndex: number): void;
  onUseItem(item: keyof BagInventory): void;
  onSwitchPokemon(teamIndex: number): void;
  onToggleMute(): void;
  onToggleXrMode(): void;
  onRestartMatch(): void;
}

export class HpPlateCard {
  readonly card: xb.UICard;
  private readonly nameText: xb.UIText;
  private readonly levelText: xb.UIText;
  private readonly typeStatusText: xb.UIText;
  private readonly hpFill: xb.UIPanel;
  private readonly hpValueText: xb.UIText;
  private readonly teamDots: xb.UIPanel[];

  private displayedRatio = 1;
  private targetRatio = 1;

  constructor(sideLabel: 'YOU' | 'FOE') {
    this.nameText = new xb.UIText({
      text: 'POKEMON',
      pointerEvents: 'none',
      style: {fontSize: 20, fontWeight: 'bold', color: '#f8fafc'},
    });
    this.levelText = new xb.UIText({
      text: 'Lv.50',
      pointerEvents: 'none',
      style: {fontSize: 16, fontWeight: 'bold', color: '#cbd5e1'},
    });
    this.typeStatusText = new xb.UIText({
      text: 'FIRE',
      pointerEvents: 'none',
      style: {fontSize: 13, color: '#94a3b8'},
    });
    this.hpValueText = new xb.UIText({
      text: '175 / 175',
      pointerEvents: 'none',
      style: {fontSize: 14, fontWeight: 'bold', color: '#e2e8f0', textAlign: 'right'},
    });

    this.hpFill = new xb.UIPanel({
      pointerEvents: 'none',
      style: {
        width: '100%',
        height: '100%',
        backgroundColor: '#22c55e',
        borderRadius: 6,
      },
    });

    const hpTrack = new xb.UIPanel({
      pointerEvents: 'none',
      style: {
        width: '100%',
        height: 12,
        backgroundColor: '#0f172a',
        borderRadius: 6,
        overflow: 'hidden',
      },
      children: [this.hpFill],
    });

    this.teamDots = [0, 1, 2].map(
      () =>
        new xb.UIPanel({
          pointerEvents: 'none',
          style: {
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#ef4444',
            borderColor: '#f8fafc',
            borderWidth: 1,
          },
        })
    );

    const badgeColor = sideLabel === 'YOU' ? '#38bdf8' : '#f43f5e';
    this.card = new xb.UICard({
      size: {width: 0.38, height: 'auto'},
      pointerEvents: 'none',
      style: {
        flexDirection: 'column',
        gap: 6,
        padding: 12,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        borderColor: badgeColor,
        borderWidth: 2,
        borderRadius: 16,
      },
      children: [
        new xb.UIPanel({
          pointerEvents: 'none',
          style: {
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          children: [this.nameText, this.levelText],
        }),
        new xb.UIPanel({
          pointerEvents: 'none',
          style: {
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          children: [
            this.typeStatusText,
            new xb.UIPanel({
              pointerEvents: 'none',
              style: {flexDirection: 'row', gap: 5, alignItems: 'center'},
              children: this.teamDots,
            }),
          ],
        }),
        hpTrack,
        this.hpValueText,
      ],
    });
    this.card.add(new xb.FaceCamera({mode: 'cylindrical', smoothing: 0.18}));
    this.card.visible = false;
  }

  sync(pokemon: BattlePokemon, team: BattlePokemon[], snap = false): void {
    this.nameText.text = pokemon.species.name;
    this.levelText.text = `Lv.${pokemon.species.level}`;
    const typeStr = pokemon.species.types.join(' / ');
    const statusStr = pokemon.status !== 'NONE' ? `  [${pokemon.status}]` : '';
    this.typeStatusText.text = `${typeStr}${statusStr}`;
    this.typeStatusText.style.color =
      pokemon.status === 'BRN'
        ? '#fb923c'
        : pokemon.status === 'PAR'
          ? '#facc15'
          : pokemon.status === 'SLP'
            ? '#a78bfa'
            : TYPE_COLORS[pokemon.species.types[0]];

    this.hpValueText.text = `${pokemon.currentHp} / ${pokemon.maxHp} HP`;
    this.targetRatio = Math.max(0, Math.min(1, pokemon.currentHp / pokemon.maxHp));
    if (snap) {
      this.displayedRatio = this.targetRatio;
      this.applyHpBarVisual();
    }

    for (let i = 0; i < this.teamDots.length; i++) {
      const member = team[i];
      this.teamDots[i].style.backgroundColor =
        member && member.currentHp > 0 ? '#ef4444' : '#334155';
    }
  }

  update(dt: number): void {
    if (Math.abs(this.displayedRatio - this.targetRatio) > 0.002) {
      this.displayedRatio = THREE.MathUtils.damp(
        this.displayedRatio,
        this.targetRatio,
        8,
        dt
      );
      this.applyHpBarVisual();
    }
  }

  private applyHpBarVisual(): void {
    const pct = Math.round(Math.max(0, Math.min(100, this.displayedRatio * 100)));
    this.hpFill.style.width = `${pct}%`;
    this.hpFill.style.backgroundColor =
      this.displayedRatio > 0.5
        ? '#22c55e'
        : this.displayedRatio > 0.22
          ? '#f59e0b'
          : '#ef4444';
  }
}

export class SpatialBattleUI {
  readonly titleCard: xb.UICard;
  readonly commandCard: xb.UICard;
  readonly resultCard: xb.UICard;
  readonly playerHpPlate = new HpPlateCard('YOU');
  readonly enemyHpPlate = new HpPlateCard('FOE');

  private readonly leadButtons = new Map<string, xb.UIButton>();
  private readonly leadSummaryText: xb.UIText;

  private readonly logText: xb.UIText;
  private readonly turnBadgeText: xb.UIText;
  private readonly muteButton: xb.UIButton;
  private readonly xrModeButton: xb.UIButton;

  private readonly mainMenuPanel: xb.UIPanel;
  private readonly movesPanel: xb.UIPanel;
  private readonly bagPanel: xb.UIPanel;
  private readonly switchPanel: xb.UIPanel;

  private readonly fightBtn: xb.UIButton;
  private readonly bagBtn: xb.UIButton;
  private readonly pokemonBtn: xb.UIButton;

  private readonly moveSlots: Array<{
    button: xb.UIButton;
    title: xb.UIText;
    meta: xb.UIText;
  }> = [];
  private readonly bagItemButtons: {
    superPotion: xb.UIButton;
    fullRestore: xb.UIButton;
    xAttack: xb.UIButton;
  };
  private readonly switchSlots: Array<{
    button: xb.UIButton;
    title: xb.UIText;
    meta: xb.UIText;
  }> = [];

  private readonly resultTitleText: xb.UIText;
  private readonly resultBodyText: xb.UIText;

  private callbacks: BattleUICallbacks;
  private currentDeckMode: DeckMode = 'main';
  private forceSwitchOnly = false;

  constructor(callbacks: BattleUICallbacks) {
    this.callbacks = callbacks;

    // -----------------------------------------------------------------------
    // 1. Title & Lead Selector Card
    // -----------------------------------------------------------------------
    this.leadSummaryText = new xb.UIText({
      text: 'CHARIZARD  ·  FIRE / FLYING  ·  175 HP',
      style: {fontSize: 16, color: '#fde047', textAlign: 'center', fontWeight: 'bold'},
    });

    const row1 = POKEMON_LIST.slice(0, 3).map((p) => this.createLeadButton(p.id, p.name));
    const row2 = POKEMON_LIST.slice(3, 6).map((p) => this.createLeadButton(p.id, p.name));

    this.titleCard = new xb.UICard({
      size: {width: 0.72, height: 'auto'},
      style: {
        flexDirection: 'column',
        gap: 12,
        padding: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: '#ef4444',
        borderWidth: 2,
        borderRadius: 22,
      },
      children: [
        new xb.UIText({
          text: 'KANTO ARENA 3D',
          style: {
            fontSize: 32,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#f8fafc',
          },
        }),
        new xb.UIText({
          text: 'Generation 1  ·  3v3 Indigo Stadium Battle',
          style: {fontSize: 16, textAlign: 'center', color: '#94a3b8'},
        }),
        new xb.UIPanel({
          style: {width: '100%', flexDirection: 'row', gap: 8},
          children: row1,
        }),
        new xb.UIPanel({
          style: {width: '100%', flexDirection: 'row', gap: 8},
          children: row2,
        }),
        this.leadSummaryText,
        new xb.UIButton({
          label: 'START BATTLE',
          icon: 'swords',
          style: {
            width: '100%',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            borderRadius: 14,
          },
          onClick: () => this.callbacks.onStartBattle(),
        }),
        new xb.UIText({
          text: 'Click / Pinch UI  ·  Keys 1-4 Moves  ·  M Mute',
          style: {fontSize: 13, textAlign: 'center', color: '#cbd5e1', opacity: 0.8},
        }),
      ],
    });
    this.titleCard.position.set(0, 1.56, -1.08);

    // -----------------------------------------------------------------------
    // 2. Command Deck Card (Grabbable Battle Console)
    // -----------------------------------------------------------------------
    this.turnBadgeText = new xb.UIText({
      text: 'YOUR TURN',
      style: {fontSize: 15, fontWeight: 'bold', color: '#38bdf8'},
    });

    this.muteButton = new xb.UIButton({
      icon: 'volume_up',
      ariaLabel: 'Toggle audio mute',
      style: {width: 44, height: 36, borderRadius: 10, padding: 0},
      onClick: () => this.callbacks.onToggleMute(),
    });
    this.xrModeButton = new xb.UIButton({
      label: 'VR',
      ariaLabel: 'Toggle AR and VR stadium',
      style: {width: 56, height: 36, borderRadius: 10, fontSize: 13},
      onClick: () => this.callbacks.onToggleXrMode(),
    });
    const resetHeaderBtn = new xb.UIButton({
      icon: 'restart_alt',
      ariaLabel: 'Restart match',
      style: {width: 44, height: 36, borderRadius: 10, padding: 0},
      onClick: () => this.callbacks.onRestartMatch(),
    });

    this.logText = new xb.UIText({
      text: 'Choose your opening action!',
      style: {
        width: '100%',
        minHeight: 54,
        padding: 12,
        backgroundColor: '#0f172a',
        borderRadius: 12,
        fontSize: 16,
        lineHeight: 1.3,
        color: '#f8fafc',
        whiteSpace: 'pre-line',
      },
    });

    this.fightBtn = new xb.UIButton({
      label: 'FIGHT',
      icon: 'bolt',
      style: {flexGrow: 1, backgroundColor: '#dc2626', color: '#ffffff'},
      onClick: () => this.setDeckMode('moves'),
    });
    this.bagBtn = new xb.UIButton({
      label: 'BAG',
      icon: 'backpack',
      style: {flexGrow: 1, backgroundColor: '#d97706', color: '#ffffff'},
      onClick: () => this.setDeckMode('bag'),
    });
    this.pokemonBtn = new xb.UIButton({
      label: 'POKEMON',
      icon: 'catching_pokemon',
      style: {flexGrow: 1, backgroundColor: '#16a34a', color: '#ffffff'},
      onClick: () => this.setDeckMode('switch'),
    });
    const newMatchBtn = new xb.UIButton({
      label: 'NEW TEAM',
      icon: 'swap_horiz',
      style: {flexGrow: 1, backgroundColor: '#334155', color: '#f8fafc'},
      onClick: () => this.callbacks.onRestartMatch(),
    });

    this.mainMenuPanel = new xb.UIPanel({
      style: {width: '100%', flexDirection: 'column', gap: 8},
      children: [
        new xb.UIPanel({
          style: {width: '100%', flexDirection: 'row', gap: 8},
          children: [this.fightBtn, this.bagBtn],
        }),
        new xb.UIPanel({
          style: {width: '100%', flexDirection: 'row', gap: 8},
          children: [this.pokemonBtn, newMatchBtn],
        }),
      ],
    });

    // Moves Submenu (4 Moves + Back)
    for (let i = 0; i < 4; i++) {
      const title = new xb.UIText({
        text: 'MOVE',
        pointerEvents: 'none',
        style: {fontSize: 15, fontWeight: 'bold', color: '#ffffff'},
      });
      const meta = new xb.UIText({
        text: 'FIRE · PP 15/15',
        pointerEvents: 'none',
        style: {fontSize: 12, color: '#e2e8f0'},
      });
      const button = new xb.UIButton({
        ariaLabel: `Move slot ${i + 1}`,
        style: {
          flexGrow: 1,
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 2,
          padding: 10,
          borderRadius: 12,
        },
        children: [title, meta],
        onClick: () => this.callbacks.onSelectMove(i),
      });
      this.moveSlots.push({button, title, meta});
    }

    this.movesPanel = new xb.UIPanel({
      visible: false,
      style: {width: '100%', flexDirection: 'column', gap: 8},
      children: [
        new xb.UIPanel({
          style: {width: '100%', flexDirection: 'row', gap: 8},
          children: [this.moveSlots[0].button, this.moveSlots[1].button],
        }),
        new xb.UIPanel({
          style: {width: '100%', flexDirection: 'row', gap: 8},
          children: [this.moveSlots[2].button, this.moveSlots[3].button],
        }),
        new xb.UIButton({
          label: 'BACK',
          icon: 'arrow_back',
          style: {width: '100%', backgroundColor: '#1e293b'},
          onClick: () => this.setDeckMode('main'),
        }),
      ],
    });

    // Bag Submenu
    this.bagItemButtons = {
      superPotion: new xb.UIButton({
        label: 'SUPER POTION (+50 HP)  x2',
        icon: 'healing',
        style: {width: '100%', backgroundColor: '#0284c7'},
        onClick: () => this.callbacks.onUseItem('superPotion'),
      }),
      fullRestore: new xb.UIButton({
        label: 'FULL RESTORE (MAX + CURE)  x1',
        icon: 'auto_awesome',
        style: {width: '100%', backgroundColor: '#7c3aed'},
        onClick: () => this.callbacks.onUseItem('fullRestore'),
      }),
      xAttack: new xb.UIButton({
        label: 'X ATTACK (+ATK STAGE)  x2',
        icon: 'trending_up',
        style: {width: '100%', backgroundColor: '#dc2626'},
        onClick: () => this.callbacks.onUseItem('xAttack'),
      }),
    };
    this.bagPanel = new xb.UIPanel({
      visible: false,
      style: {width: '100%', flexDirection: 'column', gap: 8},
      children: [
        this.bagItemButtons.superPotion,
        this.bagItemButtons.fullRestore,
        this.bagItemButtons.xAttack,
        new xb.UIButton({
          label: 'BACK',
          icon: 'arrow_back',
          style: {width: '100%', backgroundColor: '#1e293b'},
          onClick: () => this.setDeckMode('main'),
        }),
      ],
    });

    // Squad Switch Submenu
    for (let i = 0; i < 3; i++) {
      const title = new xb.UIText({
        text: 'POKEMON',
        pointerEvents: 'none',
        style: {fontSize: 15, fontWeight: 'bold', color: '#ffffff'},
      });
      const meta = new xb.UIText({
        text: '175 / 175 HP',
        pointerEvents: 'none',
        style: {fontSize: 12, color: '#cbd5e1'},
      });
      const button = new xb.UIButton({
        ariaLabel: `Switch to slot ${i + 1}`,
        style: {
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 10,
          borderRadius: 12,
        },
        children: [title, meta],
        onClick: () => this.callbacks.onSwitchPokemon(i),
      });
      this.switchSlots.push({button, title, meta});
    }

    const switchBackBtn = new xb.UIButton({
      label: 'BACK',
      icon: 'arrow_back',
      style: {width: '100%', backgroundColor: '#1e293b'},
      onClick: () => {
        if (!this.forceSwitchOnly) this.setDeckMode('main');
      },
    });
    this.switchPanel = new xb.UIPanel({
      visible: false,
      style: {width: '100%', flexDirection: 'column', gap: 8},
      children: [
        this.switchSlots[0].button,
        this.switchSlots[1].button,
        this.switchSlots[2].button,
        switchBackBtn,
      ],
    });

    this.commandCard = new xb.UICard({
      size: {width: 0.72, height: 'auto'},
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 10,
        padding: 14,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: '#475569',
        borderWidth: 2,
        borderRadius: 20,
      },
      children: [
        new xb.UIPanel({
          style: {
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          children: [
            this.turnBadgeText,
            new xb.UIPanel({
              style: {flexDirection: 'row', gap: 6, alignItems: 'center'},
              children: [this.xrModeButton, this.muteButton, resetHeaderBtn],
            }),
          ],
        }),
        this.logText,
        this.mainMenuPanel,
        this.movesPanel,
        this.bagPanel,
        this.switchPanel,
      ],
    });
    this.commandCard.position.set(0, 0.94, -0.84);
    this.commandCard.rotation.x = -0.26;
    this.commandCard.visible = false;

    // -----------------------------------------------------------------------
    // 3. Result Summary Card (Victory / Defeat)
    // -----------------------------------------------------------------------
    this.resultTitleText = new xb.UIText({
      text: 'VICTORY!',
      style: {fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: '#fde047'},
    });
    this.resultBodyText = new xb.UIText({
      text: 'You defeated the Kanto Champion squad!',
      style: {
        fontSize: 17,
        lineHeight: 1.4,
        textAlign: 'center',
        color: '#e2e8f0',
        whiteSpace: 'pre-line',
      },
    });
    this.resultCard = new xb.UICard({
      size: {width: 0.62, height: 'auto'},
      style: {
        flexDirection: 'column',
        gap: 16,
        padding: 22,
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderColor: '#facc15',
        borderWidth: 2,
        borderRadius: 22,
      },
      children: [
        this.resultTitleText,
        this.resultBodyText,
        new xb.UIButton({
          label: 'PLAY AGAIN',
          icon: 'replay',
          style: {width: '100%', backgroundColor: '#dc2626', color: '#ffffff'},
          onClick: () => this.callbacks.onRestartMatch(),
        }),
      ],
    });
    this.resultCard.position.set(0, 1.48, -1.06);
    this.resultCard.visible = false;
  }

  private createLeadButton(id: string, name: string): xb.UIButton {
    const btn = new xb.UIButton({
      label: name,
      style: {
        flexGrow: 1,
        fontSize: 14,
        borderRadius: 12,
        backgroundColor: id === 'charizard' ? '#ea580c' : '#1e293b',
      },
      onClick: () => this.callbacks.onSelectLead(id),
    });
    this.leadButtons.set(id, btn);
    return btn;
  }

  highlightSelectedLead(speciesId: string): void {
    const selected = POKEMON_LIST.find((p) => p.id === speciesId) ?? POKEMON_LIST[0];
    this.leadSummaryText.text = `${selected.name}  ·  ${selected.types.join(' / ')}  ·  ${selected.maxHp} HP`;
    this.leadSummaryText.style.color = selected.primaryColor;

    for (const [id, btn] of this.leadButtons.entries()) {
      const p = POKEMON_LIST.find((item) => item.id === id);
      btn.style.backgroundColor =
        id === speciesId && p ? TYPE_COLORS[p.types[0]] : '#1e293b';
    }
  }

  showTitleState(): void {
    this.titleCard.visible = true;
    this.commandCard.visible = false;
    this.resultCard.visible = false;
    this.playerHpPlate.card.visible = false;
    this.enemyHpPlate.card.visible = false;
  }

  showBattleState(useSpatialHpPlates = false): void {
    this.titleCard.visible = false;
    this.commandCard.visible = true;
    this.resultCard.visible = false;
    this.playerHpPlate.card.visible = useSpatialHpPlates;
    this.enemyHpPlate.card.visible = useSpatialHpPlates;
  }

  setSpatialHpPlatesVisible(visible: boolean): void {
    if (!this.commandCard.visible) return;
    this.playerHpPlate.card.visible = visible;
    this.enemyHpPlate.card.visible = visible;
  }

  showResultState(victory: boolean, summary: string): void {
    this.titleCard.visible = false;
    this.commandCard.visible = false;
    this.resultCard.visible = true;
    this.playerHpPlate.card.visible = false;
    this.enemyHpPlate.card.visible = false;
    this.resultTitleText.text = victory ? 'KANTO CHAMPION!' : 'DEFEATED!';
    this.resultTitleText.style.color = victory ? '#fde047' : '#f87171';
    this.resultBodyText.text = summary;
  }

  setLog(text: string): void {
    this.logText.text = text;
  }

  setMuteVisual(muted: boolean): void {
    this.muteButton.icon = muted ? 'volume_off' : 'volume_up';
  }

  setXrModeVisual(isVr: boolean): void {
    this.xrModeButton.label = isVr ? 'AR' : 'VR';
  }

  setDeckMode(mode: DeckMode, forceSwitch = false): void {
    this.currentDeckMode = mode;
    this.forceSwitchOnly = forceSwitch;

    this.mainMenuPanel.visible = mode === 'main';
    this.movesPanel.visible = mode === 'moves';
    this.bagPanel.visible = mode === 'bag';
    this.switchPanel.visible = mode === 'switch';

    const isBusy = mode === 'busy';
    this.turnBadgeText.text = isBusy
      ? 'BATTLE IN PROGRESS...'
      : forceSwitch
        ? 'CHOOSE NEXT POKEMON'
        : 'YOUR TURN';
    this.turnBadgeText.style.color = isBusy
      ? '#facc15'
      : forceSwitch
        ? '#f87171'
        : '#38bdf8';

    this.fightBtn.disabled = isBusy;
    this.bagBtn.disabled = isBusy;
    this.pokemonBtn.disabled = isBusy;
  }

  getDeckMode(): DeckMode {
    return this.currentDeckMode;
  }

  syncCombatContext(
    playerActive: BattlePokemon,
    enemyActive: BattlePokemon,
    playerTeam: BattlePokemon[],
    enemyTeam: BattlePokemon[],
    bag: BagInventory,
    activeIndex: number,
    snapHp = false
  ): void {
    this.playerHpPlate.sync(playerActive, playerTeam, snapHp);
    this.enemyHpPlate.sync(enemyActive, enemyTeam, snapHp);

    // Sync 4 move slots with live PP & Type Effectiveness hint
    for (let i = 0; i < 4; i++) {
      const slot = this.moveSlots[i];
      const moveInst = playerActive.moves[i];
      const move = moveInst.data;
      const eff =
        move.power > 0
          ? getTypeEffectiveness(move.type, enemyActive.species.types)
          : 1;
      const effBadge =
        eff >= 2
          ? ' · 2x SUPER'
          : eff === 0
            ? ' · 0x IMMUNE'
            : eff < 1
              ? ' · 0.5x'
              : '';

      slot.title.text = `${i + 1}. ${move.name}`;
      slot.meta.text = `${move.type} · PP ${moveInst.pp}/${move.maxPp}${effBadge}`;
      slot.button.style.backgroundColor = TYPE_COLORS[move.type];
      slot.button.disabled = moveInst.pp <= 0 || this.currentDeckMode === 'busy';
    }

    // Sync Bag counts
    this.bagItemButtons.superPotion.label = `SUPER POTION (+50 HP)  x${bag.superPotion}`;
    this.bagItemButtons.superPotion.disabled =
      bag.superPotion <= 0 || playerActive.currentHp >= playerActive.maxHp;

    this.bagItemButtons.fullRestore.label = `FULL RESTORE (MAX + CURE)  x${bag.fullRestore}`;
    this.bagItemButtons.fullRestore.disabled =
      bag.fullRestore <= 0 ||
      (playerActive.currentHp >= playerActive.maxHp &&
        playerActive.status === 'NONE');

    this.bagItemButtons.xAttack.label = `X ATTACK (+ATK STAGE)  x${bag.xAttack}`;
    this.bagItemButtons.xAttack.disabled =
      bag.xAttack <= 0 || playerActive.atkStage >= 4;

    // Sync Switch Team slots
    for (let i = 0; i < 3; i++) {
      const member = playerTeam[i];
      const slot = this.switchSlots[i];
      if (!member) {
        slot.button.visible = false;
        continue;
      }
      slot.button.visible = true;
      const isActive = i === activeIndex;
      const isFainted = member.currentHp <= 0;
      slot.title.text = `${member.species.name}${isActive ? ' (ACTIVE)' : ''}`;
      slot.meta.text = isFainted
        ? 'FAINTED'
        : `${member.currentHp}/${member.maxHp} HP${member.status !== 'NONE' ? ` [${member.status}]` : ''}`;
      slot.button.style.backgroundColor = isActive
        ? '#1d4ed8'
        : isFainted
          ? '#334155'
          : '#0f766e';
      slot.button.disabled = isActive || isFainted;
    }
  }

  update(dt: number): void {
    this.playerHpPlate.update(dt);
    this.enemyHpPlate.update(dt);
  }
}
