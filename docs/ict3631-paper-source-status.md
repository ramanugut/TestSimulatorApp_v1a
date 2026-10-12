# ICT3631 previous exam sources

Checked on 12 October 2026. Four selectable **partial previews** are now in the
app. They contain five short, exact questions with 26 available marks in total.
Each original exam was 100 marks; these previews are not complete exams.

| Session | In-app file | Included | Source |
| --- | --- | --- | --- |
| Oct/Nov 2023 | `ict3631-oct-nov-2023-exam-excerpts.json` | One Question 2 excerpt, 6 marks | [Studocu](https://www.studocu.com/en-za/document/university-of-south-africa/advanced-operating-system-practice/ict3631-exam-oct-2023/71677321) |
| Oct/Nov 2022 | `ict3631-oct-nov-2022-exam-excerpts.json` | One Question 1 excerpt, 4 marks | [Studocu](https://www.studocu.com/en-za/document/university-of-south-africa/advanced-operating-system-practice/ict3631-oct-nov-22-paper-final/45206717) |
| Sep/Nov 2021 | `ict3631-sep-nov-2021-exam-excerpts.json` | Section A questions 1.1 and 1.5, 14 marks | [Course Hero](https://www.coursehero.com/file/106967036/ICT3631-EXAMINATIONpdf/) |
| Oct/Nov 2020 | `ict3631-oct-nov-2020-exam-excerpts.json` | One Question 1 excerpt, 2 marks | [Studocu](https://www.studocu.com/en-za/document/university-of-south-africa/advanced-operating-system-practice/octnov-2020-ict3631-paper-final/17639529) |

## Import rules

- Preserve original question wording and marks; normalise line wrapping only.
- Use a section/excerpt label when the original subquestion digits are unreadable.
  Do not invent those digits, missing IP addresses, tables or questions.
- Keep answers, marking rubrics, explanations and student notes separate from
  the question. Answers are model study answers, not an official UNISA memo.
- Display the available marks and original marks separately. Scores use only
  the included questions. Source links are available in the picker and above
  the questions in both app layouts.
- These short excerpts stay within the limit for quoting a web source. A full
  exact import needs an original PDF supplied by the user or an appropriately
  licensed complete source. Public previews are also missing pages or data.

## Other leads, not imported as exams

The ICT3631 picker also has a separate source-link section for the 2017 original
listing, the May/June 2017 answers and the unreadable 2016 preview. Those links
are not counted as imported papers or used by the custom-test builder.

| Lead | Why it is pending |
| --- | --- |
| [May/June 2017](https://www.studocu.com/en-za/document/university-of-south-africa/advanced-operating-system-practice/exam-14-may-2017-answers/4766731) | Answers document; original questions not verified. |
| [Oct/Nov 2017 original listing](https://www.coursehero.com/file/28090051/ICT3631-2017-10-E-1pdf/) | Original paper listing found; readable question text not retrieved. |
| [Oct/Nov 2017 answers](https://www.studocu.com/en-za/document/university-of-south-africa/advanced-operating-system-practice/exam-10-november-2017-answers/4766728) | Answers are not a substitute for an original question paper. |
| [October 2016](https://www.studocu.com/en-za/document/university-of-south-africa/advanced-operating-system-practice/exam-october-2016-questions/6825358) | Listing exists, but question text is unreadable in the retrieved preview. |
| 2024 | Only answer/preparation material confirmed; no complete original paper verified. |

The existing Jan/Feb 2025 command-practice file is still separately labelled
as paraphrased practice. This update does not turn it into an original exam.

## Answer checks

The answers were checked against Red Hat's chkconfig documentation, Samba's
smbd/nmbd manuals, Vim's feature documentation and the systemctl manual.
The 2022 restart question does not specify an init system. Its model answer
therefore explains legacy-script behaviour separately from systemd: an inactive
unit is started by systemd restart; a failed stop is not a universal outcome.

AI-assisted rubrics award partial credit and accept equivalent correct commands
and explanations. Live AI grading still requires the app's configured service.
