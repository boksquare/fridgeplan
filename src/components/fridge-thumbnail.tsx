import { compartmentOpensAsLabel, fridgePanels, groupIntoBands, isFreezerPanel } from '@/lib/fridge-layout';
import type { LayoutCompartment } from '@/lib/fridge-layout';
import type { FridgeType } from '@/generated/prisma/enums';

/**
 * A small flat drawing of a fridge type, for the four choices on the type
 * picker. The configured fridge itself is rendered as a real 3D model — this is
 * deliberately cheap, because browsers cap how many WebGL contexts one page can
 * hold and five canvases on the picker would risk losing them.
 *
 * Nothing here is interactive, so there is no hover state and no open state:
 * the coplanar CSS layers that used to z-fight and flicker are gone with them.
 */
export function FridgeThumbnail({
  type,
  compartments,
}: {
  type: FridgeType;
  compartments: LayoutCompartment[];
}) {
  const columns = fridgePanels(type, compartments);

  return (
    <div
      className="flex aspect-[3/4] w-full gap-1 rounded-xl border border-slate-300/70 bg-slate-800 p-1 dark:border-slate-700"
      role="img"
      aria-label={`${type.replace(/_/g, ' ')} layout`}
    >
      {columns.map((column, columnIndex) => (
        <div
          key={columnIndex}
          className="flex min-w-0 flex-col gap-1"
          style={{ flexGrow: column.grow, flexBasis: 0 }}
        >
          {groupIntoBands(column.panels).map((band, bandIndex) => (
            <div
              key={bandIndex}
              className="flex min-h-0 gap-1"
              style={{ flexGrow: band[0]!.grow, flexBasis: 0 }}
            >
              {band.map((panel) => (
                <div
                  key={panel.id}
                  className={`relative flex flex-1 items-end overflow-hidden rounded-md p-1 ${
                    isFreezerPanel(panel)
                      ? 'bg-gradient-to-br from-sky-100 to-slate-300'
                      : 'bg-gradient-to-br from-slate-50 to-slate-300'
                  }`}
                >
                  {/* The pull: a bar for a drawer, a stile for a door. */}
                  <span
                    aria-hidden
                    className={
                      panel.opens === 'drawer'
                        ? 'absolute inset-x-[22%] top-1.5 h-[3px] rounded-full bg-slate-400/80'
                        : `absolute top-[14%] h-[40%] w-[3px] rounded-full bg-slate-400/80 ${
                            panel.hinge === 'left' ? 'right-1.5' : 'left-1.5'
                          }`
                    }
                  />
                  <span className="truncate text-[10px] font-semibold leading-tight text-slate-700">
                    {compartmentOpensAsLabel(panel)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
