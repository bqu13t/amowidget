'use client';
import { useEffect, useState, useMemo } from "react";

export interface CustomFieldValue {
  field_id: number;
  field_name: string;
  field_code?: string;
  field_type: string;
  values: Array<{
    value: string | number | boolean;
    enum_id?: number;
    enum_code?: string;
  }>;
}

export interface Lead {
  id: number;
  name: string;
  price?: number;
  responsible_user_id: number;
  custom_fields_values?: CustomFieldValue[];
  created_at: number;
  pipeline_id: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  leads?: Lead[]; // заявки
}

export interface Pipeline {
  id: number;
  name: string;
}

// Тип для того, как мы будем хранить сгруппированные данные
type GroupedData = {
  [specialty: string]: {
    [form: string]: {
      "9": number;
      "11": number;
      total: number;
    };
  };
};

// Функция достаёт значение поля по названию, если оно есть
function getFieldValue(fields: CustomFieldValue[] | undefined, fieldName: string): string | undefined {
  if (!fields) return undefined;

  for (let i = 0; i < fields.length; i++) {
    if (fields[i].field_name === fieldName) {
      if (fields[i].values.length > 0) {
        return fields[i].values[0].value?.toString();
      }
    }
  }

  return undefined;
}

export default function Home() {
  const now = new Date();
  const monthNames = [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"
  ];

  const [selectedMonth, setSelectedMonth] = useState<number | null>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number | null>(now.getFullYear());
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [groupedData, setGroupedData] = useState<GroupedData>({});
  const [users, setUsers] = useState<User[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  // Cписок лет в фильтре
  const years = useMemo(() => {
    const result = [];
    for (let year = 2030; year >= 2024; year--) {
      result.push(year);
    }
    return result;
  }, []);

  // Подгружаем данные при запуске из API amocrm
  useEffect(() => {
    async function fetchData() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/amo`);
      const json = await res.json();
      setUsers(json.users);
      setPipelines(json.pipelines);
    }

    fetchData();
  }, []);

  // Когда что-то меняется (месяц, год, менеджер) — пересчитываем таблицу
  useEffect(() => {
    const data: GroupedData = {};
    const currentPipelineName = "Студенты " + (selectedYear ?? now.getFullYear());

    // Находим нужную воронку по имени
    let currentPipelineId = null;
    for (let i = 0; i < pipelines.length; i++) {
      if (pipelines[i].name === currentPipelineName) {
        currentPipelineId = pipelines[i].id;
        break;
      }
    }

    // Проходим по всем пользователям
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (selectedUserId !== null && user.id !== selectedUserId) continue;

      if (!user.leads) continue;

      // Проходим по заявкам менеджера
      for (let j = 0; j < user.leads.length; j++) {
        const lead = user.leads![j] as Lead;
        const createdDate = new Date(lead.created_at * 1000); // переводим из UNIX

        // Проверка месяца и года
        const matchesMonth = selectedMonth === null || createdDate.getMonth() === selectedMonth;
        const matchesYear = selectedYear === null || createdDate.getFullYear() === selectedYear;
        if (!matchesMonth || !matchesYear) continue;

        // Проверка, что заявка из нужного pipeline
        if (!currentPipelineId || lead.pipeline_id !== currentPipelineId) continue;

        // Достаём значения полей
        const fields = lead.custom_fields_values as CustomFieldValue[] | undefined;
        const specialty = getFieldValue(fields, "Специальность") || "Не указано";
        const form = getFieldValue(fields, "Форма") || "Не указано";
        let base = getFieldValue(fields, "База");

        if (base) {
          base = base.trim().replace(" класс", ""); // убираем лишнее
        }

        if (base !== "9" && base !== "11") continue;

        // Если такой специальности ещё нет — создаём
        if (!data[specialty]) {
          data[specialty] = {};
        }

        // Если такой формы обучения ещё нет — создаём
        if (!data[specialty][form]) {
          data[specialty][form] = { "9": 0, "11": 0, total: 0 };
        }

        // Считаем
        data[specialty][form][base] += 1;
        data[specialty][form].total += 1;
      }
    }

    // Сохраняем результат
    setGroupedData(data);
  }, [users, pipelines, selectedMonth, selectedYear, selectedUserId]);

  // Считает всего сколько заявок по базе 9 или 11
  function calculateTotalByBase(base: "9" | "11") {
    let total = 0;
    for (const specialty in groupedData) {
      for (const form in groupedData[specialty]) {
        total += groupedData[specialty][form][base];
      }
    }
    return total;
  }

  // Считает всего всех заявок
  function calculateTotalOverall() {
    let total = 0;
    for (const specialty in groupedData) {
      for (const form in groupedData[specialty]) {
        total += groupedData[specialty][form].total;
      }
    }
    return total;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-base font-bold mb-4">
        Статистика по специальностям:{" "}
        {selectedMonth !== null ? monthNames[selectedMonth] : "все месяцы"}{" "}
        {selectedYear !== null ? selectedYear : "все года"}
      </h1>

      {/* Фильтры сверху */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Месяц */}
        <div>
          <label className="block mb-1 text-xs text-gray-600">Месяц:</label>
          <select
            className="main-filter p-2"
            value={selectedMonth ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") setSelectedMonth(null);
              else setSelectedMonth(parseInt(val));
            }}
          >
            <option value="">Все месяцы</option>
            {
              (() => {
                const options = [];
                for (let i = 0; i < monthNames.length; i++) {
                  options.push(
                    <option key={i} value={i}>
                      {monthNames[i].charAt(0).toUpperCase() + monthNames[i].slice(1)}
                    </option>
                  );
                }
                return options;
              })()
            }
          </select>
        </div>

        {/* Год */}
        <div>
          <label className="block mb-1 text-xs text-gray-600">Год:</label>
          <select
            className="main-filter p-2"
            value={selectedYear ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") setSelectedYear(null);
              else setSelectedYear(parseInt(val));
            }}
          >
            <option value="">Все года</option>
            {
              (() => {
                const options = [];
                for (let i = 0; i < years.length; i++) {
                  options.push(
                    <option key={years[i]} value={years[i]}>
                      {years[i]}
                    </option>
                  );
                }
                return options;
              })()
            }
          </select>
        </div>

        {/* Менеджер */}
        <div>
          <label className="block mb-1 text-xs text-gray-600">Менеджер:</label>
          <select
            className="main-filter p-2"
            value={selectedUserId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") setSelectedUserId(null);
              else setSelectedUserId(parseInt(val));
            }}
          >
            <option value="">Все менеджеры</option>
            {
              (() => {
                const options = [];
                for (let i = 0; i < users.length; i++) {
                  options.push(
                    <option key={users[i].id} value={users[i].id}>
                      {users[i].name}
                    </option>
                  );
                }
                return options;
              })()
            }
          </select>
        </div>
      </div>

      {/* Таблица с итогами */}
      <table className="summary-table">
        <thead className="summary-header">
          <tr>
            <th className="px-4 py-2 text-left top-left-cell">Специальность</th>
            <th className="px-4 py-2 text-left">Форма обучения</th>
            <th className="px-4 py-2 text-right">11 класс</th>
            <th className="px-4 py-2 text-right">9 класс</th>
            <th className="px-4 py-2 text-right top-right-cell">Итого</th>
          </tr>
        </thead>
        <tbody>
          {
            (() => {
              const rows = [];
              for (const specialty in groupedData) {
                let firstRow = true;
                for (const form in groupedData[specialty]) {
                  const counts = groupedData[specialty][form];
                  rows.push(
                    <tr key={`${specialty}-${form}`} className="text-xs">
                      <td className="px-4 py-2">{firstRow ? specialty : ""}</td>
                      <td className="px-4 py-2">{form}</td>
                      <td className="px-4 py-2 text-right">{counts["11"]}</td>
                      <td className="px-4 py-2 text-right">{counts["9"]}</td>
                      <td className="px-4 py-2 font-bold text-right">{counts.total}</td>
                    </tr>
                  );
                  firstRow = false;
                }
              }
              return rows;
            })()
          }

          {/* Последняя строка — общий итог */}
          <tr className="summary-row summary-footer">
            <td className="px-4 py-2 font-bold bottom-left-cell" colSpan={2}>Итого по всем</td>
            <td className="px-4 py-2 font-bold text-right">{calculateTotalByBase("11")}</td>
            <td className="px-4 py-2 font-bold text-right">{calculateTotalByBase("9")}</td>
            <td className="px-4 py-2 font-bold text-right bottom-right-cell">{calculateTotalOverall()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
