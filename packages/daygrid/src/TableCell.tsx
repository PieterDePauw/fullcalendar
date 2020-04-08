import {
  Ref,
  ComponentChildren,
  h,
  DateMarker,
  DateComponent,
  ComponentContext,
  CssDimValue,
  DateProfile,
  DateRange,
  buildNavLinkData,
  DayCellHookProps,
  RenderHook,
  WeekNumberRoot,
  DayCellRoot,
  DayCellContent,
  BaseComponent,
  EventRenderRange,
  addDays,
  intersectRanges,
} from '@fullcalendar/core'
import TableSeg from './TableSeg'


export interface TableCellProps {
  date: DateMarker
  extraHookProps?: object
  extraDataAttrs?: object
  extraClassNames?: string[]
  elRef?: Ref<HTMLTableCellElement>
  innerElRef?: Ref<HTMLDivElement>
  bgContent: ComponentChildren
  fgContentElRef?: Ref<HTMLDivElement> // TODO: rename!!! classname confusion. is the "event" div
  fgContent: ComponentChildren
  fgPaddingBottom: CssDimValue
  hasEvents: boolean // TODO: do something with this
  moreCnt: number
  moreMarginTop: number
  showDayNumber: boolean
  showWeekNumber: boolean
  dateProfile: DateProfile
  todayRange: DateRange
  buildMoreLinkText: (num: number) => string
  onMoreClick?: (arg: MoreLinkArg) => void
  allFgSegs: TableSeg[] // for more-popover. includes segs that aren't rooted in this cell but that pass over it
  segIsHidden: { [instanceId: string]: boolean } // for more-popover. TODO: rename to be about selected instances
}

export interface TableCellModel { // TODO: move somewhere else. combine with DayTableCell?
  key: string
  date: DateMarker
  extraHookProps?: object
  extraDataAttrs?: object
  extraClassNames?: string[]
}

export interface MoreLinkArg {
  date: DateMarker
  allSegs: TableSeg[]
  hiddenSegs: TableSeg[]
  moreCnt: number
  dayEl: HTMLElement
  ev: UIEvent
}

export interface HookProps {
  date: Date
  isPast: boolean
  isFuture: boolean
  isToday: boolean
}

const DEFAULT_WEEK_NUM_FORMAT = { week: 'narrow' }


export default class TableCell extends DateComponent<TableCellProps> {


  render(props: TableCellProps, state: {}, context: ComponentContext) {
    let { options } = context
    let { date } = props

    return (
      <DayCellRoot
        date={date}
        todayRange={props.todayRange}
        dateProfile={props.dateProfile}
        showDayNumber={props.showDayNumber}
        extraHookProps={props.extraHookProps}
        elRef={props.elRef}
      >
        {(rootElRef, classNames, rootDataAttrs, isDisabled) => (
          <td
            ref={rootElRef}
            class={[ 'fc-daygrid-day' ].concat(classNames, props.extraClassNames || []).join(' ')}
            {...rootDataAttrs}
            {...props.extraDataAttrs}
          >
            {!isDisabled && // only render inside if not disabled. TODO: what about week number?
              <div class='fc-daygrid-day-frame fc-scrollgrid-sync-inner' ref={props.innerElRef /* different from hook system! RENAME */}>
                {props.showWeekNumber &&
                  <WeekNumberRoot date={date} defaultFormat={DEFAULT_WEEK_NUM_FORMAT}>
                    {(rootElRef, classNames, innerElRef, innerContent) => (
                      <a
                        ref={rootElRef}
                        class={[ 'fc-daygrid-week-number' ].concat(classNames).join(' ')}
                        data-navlink={options.navLinks ? buildNavLinkData(date, 'week') : null}
                      >
                        {innerContent}
                      </a>
                    )}
                  </WeekNumberRoot>
                }
                <div class='fc-daygrid-day-fg'>
                  <TableCellTop
                    date={date}
                    showDayNumber={props.showDayNumber}
                    dateProfile={props.dateProfile}
                    todayRange={props.todayRange}
                    extraHookProps={props.extraHookProps}
                  />
                  <div
                    class='fc-daygrid-day-events'
                    ref={props.fgContentElRef}
                    style={{ paddingBottom: props.fgPaddingBottom }}
                  >
                    {props.fgContent}
                    {Boolean(props.moreCnt) &&
                      <div class='fc-daygrid-day-bottom' style={{ marginTop: props.moreMarginTop }}>
                        <RenderHook name='moreLink'
                          hookProps={{ num: props.moreCnt, text: props.buildMoreLinkText(props.moreCnt), view: context.view }}
                          defaultContent={renderMoreLinkInner}
                        >
                          {(rootElRef, classNames, innerElRef, innerContent) => (
                            <a onClick={this.handleMoreLink} ref={rootElRef} className={[ 'fc-daygrid-more-link' ].concat(classNames).join(' ')}>
                              {innerContent}
                            </a>
                          )}
                        </RenderHook>
                      </div>
                    }
                  </div>
                </div>
                <div class='fc-daygrid-day-bg'>
                  {props.bgContent}
                </div>
              </div>
            }
          </td>
        )}
      </DayCellRoot>
    )
  }


  handleMoreLink = (ev: UIEvent) => {
    let { props } = this

    if (props.onMoreClick) {
      let allSegs = resliceDaySegs(props.allFgSegs, props.date)
      let hiddenSegs = allSegs.filter(
        (seg: TableSeg) => props.segIsHidden[seg.eventRange.instance.instanceId]
      )

      props.onMoreClick({
        date: props.date,
        allSegs,
        hiddenSegs,
        moreCnt: props.moreCnt,
        dayEl: this.base as HTMLElement, // TODO: bad pattern
        ev
      })
    }
  }

}


function renderCellHeaderInner(props: DayCellHookProps) {
  if (props.dayNumberText) {
    return (
      <a className='fc-daygrid-day-number' data-navlink={props.navLinkData}>
        {props.dayNumberText}
      </a>
    )
  }
}


function renderMoreLinkInner(props) {
  return props.text
}


// Given the events within an array of segment objects, reslice them to be in a single day
function resliceDaySegs(segs, dayDate) {
  let dayStart = dayDate
  let dayEnd = addDays(dayStart, 1)
  let dayRange = { start: dayStart, end: dayEnd }
  let newSegs = []

  for (let seg of segs) {
    let eventRange = seg.eventRange
    let origRange = eventRange.range
    let slicedRange = intersectRanges(origRange, dayRange)

    if (slicedRange) {
      newSegs.push({
        ...seg,
        eventRange: {
          def: eventRange.def,
          ui: { ...eventRange.ui, durationEditable: false }, // hack to disable resizing
          instance: eventRange.instance,
          range: slicedRange
        } as EventRenderRange,
        isStart: seg.isStart && slicedRange.start.valueOf() === origRange.start.valueOf(),
        isEnd: seg.isEnd && slicedRange.end.valueOf() === origRange.end.valueOf()
      })
    }
  }

  return newSegs
}


interface TableCellTopProps {
  date: DateMarker
  showDayNumber: boolean
  dateProfile: DateProfile
  todayRange: DateRange
  extraHookProps?: object
}

class TableCellTop extends BaseComponent<TableCellTopProps> {

  render(props: TableCellTopProps) {
    return (
      <DayCellContent
        date={props.date}
        todayRange={props.todayRange}
        dateProfile={props.dateProfile}
        showDayNumber={props.showDayNumber}
        extraHookProps={props.extraHookProps}
        defaultContent={renderCellHeaderInner}
      >
        {(innerElRef, innerContent) => (
          innerContent &&
            <div class='fc-daygrid-day-top' ref={innerElRef}>
              {innerContent}
            </div>
        )}
      </DayCellContent>
    )
  }

}
