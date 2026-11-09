"use client";

import { useMemo, useState } from "react";
import { AvatarCanvas, renderAvatarToCanvas } from "@/components/avatar/avatar-canvas";
import {
  BEARD_COLORS,
  CLOTHING_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
} from "@/lib/avatar/colors";
import { defaultAvatarConfig, parseAvatarConfig } from "@/lib/avatar/defaults";
import {
  availableBeardStyles,
  availableClothingStyles,
  availableHairStyles,
  hairLabel,
} from "@/lib/avatar/manifest";
import { LOCAL_AVATAR_KEY, type AvatarConfig, type AvatarGender } from "@/lib/avatar/types";

type Tab = "body" | "hair" | "beard" | "clothes";

function randomOf<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function AvatarMaker({
  initial,
  onChange,
}: {
  initial?: AvatarConfig | null;
  onChange?: (config: AvatarConfig) => void;
}) {
  const [config, setConfig] = useState<AvatarConfig>(() => {
    const seed = parseAvatarConfig(JSON.stringify(initial)) ?? defaultAvatarConfig("male");
    return seed;
  });
  const [tab, setTab] = useState<Tab>("body");
  const hairStyles = useMemo(
    () => availableHairStyles(config.gender),
    [config.gender],
  );
  const beardStyles = useMemo(() => availableBeardStyles(), []);
  const clothingStyles = useMemo(() => availableClothingStyles(), []);

  function update(next: AvatarConfig) {
    if (next.gender === "female" && tab === "beard") setTab("body");
    setConfig(next);
    onChange?.(next);
    try {
      localStorage.setItem(LOCAL_AVATAR_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }

  function patch(partial: Partial<AvatarConfig>) {
    update({ ...config, ...partial });
  }

  function setGender(gender: AvatarGender) {
    if (gender === config.gender) return;
    if (gender === "female" && tab === "beard") setTab("body");
    const hair = availableHairStyles(gender)[0] ?? config.hairStyle;
    update({
      ...defaultAvatarConfig(gender),
      skinTone: config.skinTone,
      hairColor: config.hairColor,
      clothingColor: config.clothingColor,
      hairStyle: hair,
      clothing: config.clothing,
      bodyType: config.bodyType,
    });
  }

  function randomize() {
    const gender = randomOf(["male", "female"] as const);
    const hairs = availableHairStyles(gender);
    update({
      gender,
      bodyType: randomOf(["slim", "regular", "broad"] as const),
      skinTone: randomOf(SKIN_TONES),
      hairStyle: randomOf(hairs),
      hairColor: randomOf(HAIR_COLORS),
      beardStyle: gender === "male" ? randomOf(availableBeardStyles()) : "none",
      beardColor: randomOf(BEARD_COLORS),
      clothing: randomOf(availableClothingStyles()),
      clothingColor: randomOf(CLOTHING_COLORS),
      eyeColor: config.eyeColor,
      accessories: [],
    });
  }

  function reset() {
    update(defaultAvatarConfig(config.gender));
  }

  async function exportPng(exportSize: 512 | 1024) {
    const canvas = document.createElement("canvas");
    await renderAvatarToCanvas(canvas, config, exportSize);
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `mm-avatar-${config.gender}-${exportSize}.png`;
    link.click();
  }

  return (
    <div className="avatar-maker" data-testid="avatar-maker">
      <div className="avatar-maker-preview">
        <AvatarCanvas
          config={config}
          size={320}
          className="avatar-maker-canvas"
          testId="avatar-canvas"
        />
        <div className="avatar-maker-actions">
          <button type="button" data-testid="avatar-randomize" onClick={randomize}>
            Randomize
          </button>
          <button type="button" data-testid="avatar-reset" onClick={reset}>
            Reset
          </button>
          <button type="button" data-testid="avatar-export-512" onClick={() => void exportPng(512)}>
            Export 512
          </button>
          <button type="button" data-testid="avatar-export-1024" onClick={() => void exportPng(1024)}>
            Export 1024
          </button>
        </div>
      </div>

      <div className="avatar-maker-panel">
        <div className="avatar-maker-genders" role="radiogroup" aria-label="Character">
          {(["male", "female"] as const).map((gender) => (
            <button
              key={gender}
              type="button"
              role="radio"
              aria-checked={config.gender === gender}
              data-testid={`avatar-gender-${gender}`}
              className={config.gender === gender ? "active" : ""}
              onClick={() => setGender(gender)}
            >
              {gender === "male" ? "Male" : "Female"}
            </button>
          ))}
        </div>

        <div className="avatar-maker-tabs" role="tablist" aria-label="Customize">
          {(
            [
              ["body", "Body"],
              ["hair", "Hair"],
              ["beard", "Beard"],
              ["clothes", "Clothes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              data-testid={`avatar-tab-${id}`}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              disabled={id === "beard" && config.gender !== "male"}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "body" ? (
          <>
          <OptionGrid
            legend="Body build"
            options={[{ id: "slim", label: "Slim" }, { id: "regular", label: "Regular" }, { id: "broad", label: "Broad" }]}
            value={config.bodyType}
            onChange={(bodyType) => patch({ bodyType: bodyType as AvatarConfig["bodyType"] })}
          />
          <Swatches
            legend="Skin tone"
            values={SKIN_TONES}
            value={config.skinTone}
            onChange={(skinTone) => patch({ skinTone })}
          />
          </>
        ) : null}

        {tab === "hair" ? (
          <>
            <OptionGrid
              legend="Hairstyle"
              options={hairStyles.map((id) => ({
                id,
                label: hairLabel(config.gender, id),
              }))}
              value={config.hairStyle}
              onChange={(hairStyle) => patch({ hairStyle })}
            />
            <Swatches
              legend="Hair color"
              values={HAIR_COLORS}
              value={config.hairColor}
              onChange={(hairColor) =>
                patch({
                  hairColor,
                  beardColor:
                    config.beardColor.toLowerCase() === config.hairColor.toLowerCase()
                      ? hairColor
                      : config.beardColor,
                })
              }
            />
          </>
        ) : null}

        {tab === "beard" && config.gender === "male" ? (
          <>
            <OptionGrid
              legend="Facial hair"
              options={beardStyles.map((id) => ({
                id,
                label: id === "none" ? "Clean-shaven" : id.replace(/-/g, " "),
              }))}
              value={config.beardStyle}
              onChange={(beardStyle) => patch({ beardStyle })}
            />
            {config.beardStyle !== "none" ? (
              <Swatches
                legend="Beard color"
                values={BEARD_COLORS}
                value={config.beardColor}
                onChange={(beardColor) => patch({ beardColor })}
              />
            ) : null}
          </>
        ) : null}

        {tab === "clothes" ? (
          <>
            <OptionGrid
              legend="Clothing"
              options={clothingStyles.map((id) => ({
                id,
                label:
                  id === "tshirt"
                    ? "T-shirt"
                    : id === "hoodie"
                      ? "Hoodie"
                      : id === "jersey"
                        ? "Esports jersey"
                        : id,
              }))}
              value={config.clothing}
              onChange={(clothing) => patch({ clothing })}
            />
            <Swatches
              legend="Clothing color"
              values={CLOTHING_COLORS}
              value={config.clothingColor}
              onChange={(clothingColor) => patch({ clothingColor })}
            />
          </>
        ) : null}

        <input type="hidden" name="avatarConfig" value={JSON.stringify(config)} />
      </div>
    </div>
  );
}

function Swatches({
  legend,
  values,
  value,
  onChange,
}: {
  legend: string;
  values: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="avatar-swatches">
      <legend>{legend}</legend>
      <div className="avatar-swatch-row">
        {values.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            title={color}
            data-testid={`avatar-swatch-${color.replace("#", "").toLowerCase()}`}
            className={value.toLowerCase() === color.toLowerCase() ? "active" : ""}
            style={{ background: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function OptionGrid({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="avatar-options">
      <legend>{legend}</legend>
      <div className="avatar-option-row">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            data-testid={`avatar-option-${option.id}`}
            className={value === option.id ? "active" : ""}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
