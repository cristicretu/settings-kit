import { useId, useMemo } from "react";

export type UseSettingsFieldOptions = {
  idBase?: string;
  hasDescription?: boolean;
};

export type UseSettingsFieldResult = {
  titleId: string;
  descriptionId: string;
  labelProps: {
    ids: {
      titleId: string;
      descriptionId: string;
    };
  };
  controlProps: {
    "aria-labelledby": string;
    "aria-describedby"?: string;
  };
};

/**
 * Creates stable IDs and control aria props for settings label/control pairs.
 */
export const useSettingsField = ({
  idBase,
  hasDescription = true
}: UseSettingsFieldOptions = {}): UseSettingsFieldResult => {
  const generated = useId();
  const base = idBase ?? generated;
  const titleId = `${base}-title`;
  const descriptionId = `${base}-description`;

  return useMemo(
    () => ({
      titleId,
      descriptionId,
      labelProps: {
        ids: {
          titleId,
          descriptionId
        }
      },
      controlProps: {
        "aria-labelledby": titleId,
        ...(hasDescription ? { "aria-describedby": descriptionId } : {})
      }
    }),
    [titleId, descriptionId, hasDescription]
  );
};

