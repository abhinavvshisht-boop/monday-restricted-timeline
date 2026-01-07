import React, { useEffect, useState } from "react";
import mondaySdk from "monday-sdk-js";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const monday = mondaySdk();

/* 🟢 Helper to avoid date shift */
const toMondayDate = (date) => {
  const safe = new Date(date);
  safe.setUTCHours(12, 0, 0, 0); // ⬅️ KEY FIX
  return safe.toISOString().split("T")[0];
};

export default function App() {
  const [context, setContext] = useState(null);
  const [parentStart, setParentStart] = useState(null);
  const [parentEnd, setParentEnd] = useState(null);
  const [subitems, setSubitems] = useState([]);
  const [selectedDates, setSelectedDates] = useState({});

  /* 1️⃣ Get Context */
  useEffect(() => {
    monday.listen("context", res => {
      setContext(res.data);
    });
  }, []);

  /* 2️⃣ Load Parent Timeline + Subitems */
  useEffect(() => {
    if (!context?.itemId) return;
    loadParentAndSubitems(context.itemId);
  }, [context]);

  /* 3️⃣ Fetch Parent + Subitems */
  const loadParentAndSubitems = async (itemId) => {
    const query = `
      query {
        items(ids: ${itemId}) {
          column_values {
            id
            value
          }
          subitems {
            id
            name
            column_values {
              id
              value
            }
          }
        }
      }
    `;

    const res = await monday.api(query);
    const item = res.data.items[0];

    // 🔹 Parent timeline column ID
    const parentTimelineColumnId = "timerange_mkzc2yy4";

    const timelineColumn = item.column_values.find(
      col => col.id === parentTimelineColumnId
    );

    if (!timelineColumn?.value) {
      alert("Parent timeline is empty");
      return;
    }

    const timeline = JSON.parse(timelineColumn.value);
    setParentStart(new Date(timeline.from));
    setParentEnd(new Date(timeline.to));

    setSubitems(item.subitems);
  };

  /* 4️⃣ Save Subitem Timeline (FIXED) */
  const saveSubitemTimeline = async (subitemId) => {
    const dates = selectedDates[subitemId];
    if (!dates?.start || !dates?.end) return;

    const value = JSON.stringify({
      from: toMondayDate(dates.start),
      to: toMondayDate(dates.end)
    });

    // 🔹 Subitems board ID
    const SUBITEM_BOARD_ID = 18394308597;

    const mutation = `
      mutation {
        change_column_value(
          board_id: ${SUBITEM_BOARD_ID},
          item_id: ${subitemId},
          column_id: "timerange_mkzck13j",
          value: ${JSON.stringify(value)}
        ) {
          id
        }
      }
    `;

    await monday.api(mutation);

    monday.execute("notice", {
      message: "Subitem timeline updated",
      type: "success"
    });
  };

  if (!parentStart || !parentEnd) {
    return <div className="loading">Loading timelines...</div>;
  }

  return (
    <div className="container">
      <h2>Restricted Subitem Timeline</h2>

      <p className="parent-range">
        Parent Timeline:
        <strong>
          {" "}
          {parentStart.toDateString()} – {parentEnd.toDateString()}
        </strong>
      </p>

      {subitems.map(subitem => {
        const range = selectedDates[subitem.id] || {};

        return (
          <div key={subitem.id} className="subitem-card">
            <h4>{subitem.name}</h4>

            <DatePicker
              selectsRange
              startDate={range.start}
              endDate={range.end}
              minDate={parentStart}
              maxDate={parentEnd}
              onChange={(dates) => {
                const [start, end] = dates;
                setSelectedDates(prev => ({
                  ...prev,
                  [subitem.id]: { start, end }
                }));
              }}
              inline
            />

            <button
              disabled={!range.start || !range.end}
              onClick={() => saveSubitemTimeline(subitem.id)}
            >
              Save Timeline
            </button>
          </div>
        );
      })}
    </div>
  );
}
