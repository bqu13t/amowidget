'use client';
import { useEffect, useState, useMemo } from "react";

// тип для дополнительных полей с сделках
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
  status_id: number;
}

// Тип для менеджера
export interface User {
  id: number;
  name: string;
  email: string;
  leads?: Lead[];
}

// Тип для воронки
export interface Pipeline {
  id: number;
  name: string;
}

export default function PaidPage() {
  const now = new Date();

  const monthNames = [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"
  ];

  // Сохраняем выбранный месяц и год (по умолчанию при загрузке страницы отображаем фильтры за текущий месяц и год)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number | null>(now.getFullYear());

  // Сохраняем полученных с api amocrm менеджеров и воронки (id воронки и ее название)
  const [users, setUsers] = useState<User[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  // Создаём массив лет от 2030 до 2024, чтобы показать в дропдауне
  const years = useMemo(() => {
    const yearsArray = [];
    for (let i = 2030; i >= 2024; i--) {
      yearsArray.push(i);
    }
    return yearsArray;
  }, []);

  // получаем данные с api amocrm и сохраняем их в стейт
  useEffect(() => {
    async function fetchData() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/amo`);
      const data = await res.json();

      // Сохраняем пользователей и воронки
      setUsers(data.users);
      setPipelines(data.pipelines);
    }
    fetchData();
  }, []);

  // Ищем нужную воронку по названию (ищем ту, где "Воронка")
  const paidPipeline = useMemo(() => {
    let result = null;
    for (let i = 0; i < pipelines.length; i++) {
      if (pipelines[i].name === "Воронка") {
        result = pipelines[i];
        break;
      }
    }
    return result;
  }, [pipelines]);

  // Получаем id этой воронки
  const paidPipelineId = paidPipeline ? paidPipeline.id : null;

  // Считаем по каждому менеджеру, сколько у него оплаченных и всего сделок
  const managerStats = useMemo(() => {
    const stats = [];
    for (let u = 0; u < users.length; u++) {
      const user = users[u];
      let paid = 0; // оплаченные сделки
      let total = 0; // всего сделок

      if (user.leads && Array.isArray(user.leads)) {
        for (let l = 0; l < user.leads.length; l++) {
          const lead = user.leads[l];
          const createdDate = new Date(lead.created_at * 1000); // дата создания сделки

          // смотрим, подходит ли сделка под выбранный месяц и год
          const matchesMonth = selectedMonth === null || createdDate.getMonth() === selectedMonth;
          const matchesYear = selectedYear === null || createdDate.getFullYear() === selectedYear;

          // Если сделка из нужной воронки и подходит по дате
          if (matchesMonth && matchesYear && paidPipelineId !== null && lead.pipeline_id === paidPipelineId) {
            total++; // увеличиваем общее количество
            if (lead.status_id === 142) {
              paid++; // если статус 142 — значит оплачено
            }
          }
        }
      }

      // Добавляем статистику по этому менеджеру
      stats.push({ name: user.name, paid: paid, total: total });
    }
    return stats;
  }, [users, selectedMonth, selectedYear, pipelines]);

  // Подбиваем итоги по всем менеджерам
  let totalPaid = 0;
  let totalLeads = 0;
  for (let i = 0; i < managerStats.length; i++) {
    totalPaid += managerStats[i].paid;
    totalLeads += managerStats[i].total;
  }

  return (
    <div className="container mx-auto p-4">
      {/* Заголовок со словом "оплачено" и текущими фильтрами */}
      <h1 className="text-2xl font-bold mb-4">
        Оплачено за {selectedMonth !== null ? monthNames[selectedMonth] : "все месяцы"} {selectedYear ?? "все года"}
      </h1>

      {/* фильтры по месяцу и году */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block mb-1 text-sm text-gray-600">Месяц:</label>
          <select
            className="main-filter p-2"
            value={selectedMonth ?? ""}
            onChange={(e) => setSelectedMonth(e.target.value === "" ? null : parseInt(e.target.value))}
          >
            <option value="">Все месяцы</option>
            {monthNames.map((name, index) => (
              <option key={index} value={index}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 text-sm text-gray-600">Год:</label>
          <select
            className="main-filter p-2"
            value={selectedYear ?? ""}
            onChange={(e) => setSelectedYear(e.target.value === "" ? null : parseInt(e.target.value))}
          >
            <option value="">Все года</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Таблица со статистикой по менеджерам */}
      <table className="summary-table">
        <thead className="summary-header">
          <tr>
            <th className="px-4 py-2 text-left top-left-cell">Менеджер</th>
            <th className="px-4 py-2 text-right">Оплачено</th>
            <th className="px-4 py-2 text-right">Всего</th>
            <th className="px-4 py-2 text-right top-right-cell">Конверсия</th>
          </tr>
        </thead>
        <tbody>
          {managerStats.map((stat) => (
            <tr key={stat.name}>
              <td className="px-4 py-2">{stat.name}</td>
              <td className="px-4 py-2 text-right">{stat.paid}</td>
              <td className="px-4 py-2 text-right">{stat.total}</td>
              <td className="px-4 py-2 text-right">
                {/* считаем конверсию, если есть хотя бы одна сделка. если сделок нет, конверсия 0% */}
                {stat.total > 0 ? ((stat.paid / stat.total) * 100).toFixed(0) + "%" : "0%"}
              </td>
            </tr>
          ))}

          {/* Последняя строка — это итоги по всем */}
          <tr className="summary-row summary-footer">
            <td className="px-4 py-2 font-bold bottom-left-cell">Итого</td>
            <td className="px-4 py-2 font-bold text-right">{totalPaid}</td>
            <td className="px-4 py-2 font-bold text-right">{totalLeads}</td>
            <td className="px-4 py-2 font-bold text-right bottom-right-cell">
              {totalLeads > 0 ? ((totalPaid / totalLeads) * 100).toFixed(0) + "%" : "0%"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
