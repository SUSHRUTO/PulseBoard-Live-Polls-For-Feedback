import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarClock, Check, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";

function defaultExpiry() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

const blankQuestion = () => ({
  text: "",
  mandatory: true,
  options: [{ text: "" }, { text: "" }]
});

export default function CreatePoll() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    responseMode: "ANONYMOUS",
    expiresAt: defaultExpiry(),
    questions: [blankQuestion()]
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const totalOptions = useMemo(
    () => form.questions.reduce((sum, question) => sum + question.options.length, 0),
    [form.questions]
  );

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateQuestion(index, field, value) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, [field]: value } : question
      )
    }));
  }

  function updateOption(questionIndex, optionIndex, value) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, currentQuestionIndex) => {
        if (currentQuestionIndex !== questionIndex) return question;
        return {
          ...question,
          options: question.options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex ? { text: value } : option
          )
        };
      })
    }));
  }

  function addQuestion() {
    setForm((current) => ({ ...current, questions: [...current.questions, blankQuestion()] }));
  }

  function removeQuestion(index) {
    setForm((current) => ({
      ...current,
      questions: current.questions.filter((_, questionIndex) => questionIndex !== index)
    }));
  }

  function addOption(questionIndex) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex
          ? { ...question, options: [...question.options, { text: "" }] }
          : question
      )
    }));
  }

  function removeOption(questionIndex, optionIndex) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              options: question.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex)
            }
          : question
      )
    }));
  }

  function validateClient() {
    if (!form.title.trim()) return "Poll title is required.";
    if (new Date(form.expiresAt) <= new Date()) return "Expiry must be in the future.";
    for (const [index, question] of form.questions.entries()) {
      if (!question.text.trim()) return `Question ${index + 1} needs text.`;
      const options = question.options.map((option) => option.text.trim()).filter(Boolean);
      if (options.length < 2) return `Question ${index + 1} needs at least two options.`;
    }
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setBusy(true);
    setError("");

    try {
      const payload = {
        ...form,
        description: form.description.trim(),
        expiresAt: new Date(form.expiresAt).toISOString(),
        questions: form.questions.map((question) => ({
          text: question.text.trim(),
          mandatory: question.mandatory,
          options: question.options
            .map((option) => ({ text: option.text.trim() }))
            .filter((option) => option.text)
        }))
      };
      const data = await api("/api/polls", { method: "POST", body: payload });
      navigate(`/polls/${data.poll.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Poll builder</p>
          <h1>Create poll</h1>
        </div>
        <button className="secondary-button" type="button" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          Back
        </button>
      </div>

      <form className="builder-layout" onSubmit={handleSubmit}>
        <section className="builder-main">
          <div className="form-section">
            <h2>Poll details</h2>
            <div className="two-column">
              <label>
                Title
                <input
                  required
                  name="title"
                  value={form.title}
                  onChange={updateField}
                  placeholder="Product launch feedback"
                />
              </label>
              <label>
                Expiry time
                <input
                  required
                  type="datetime-local"
                  name="expiresAt"
                  value={form.expiresAt}
                  onChange={updateField}
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                name="description"
                rows="3"
                value={form.description}
                onChange={updateField}
                placeholder="Collect focused feedback from attendees after the demo."
              />
            </label>
            <div className="mode-control">
              <span>Response mode</span>
              <div className="segmented compact-segmented">
                <button
                  type="button"
                  className={form.responseMode === "ANONYMOUS" ? "active" : ""}
                  onClick={() => setForm((current) => ({ ...current, responseMode: "ANONYMOUS" }))}
                >
                  Anonymous
                </button>
                <button
                  type="button"
                  className={form.responseMode === "AUTHENTICATED" ? "active" : ""}
                  onClick={() =>
                    setForm((current) => ({ ...current, responseMode: "AUTHENTICATED" }))
                  }
                >
                  Authenticated
                </button>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="section-title">
              <h2>Questions</h2>
              <button className="secondary-button compact" type="button" onClick={addQuestion}>
                <Plus size={17} />
                Add question
              </button>
            </div>

            <div className="question-stack">
              {form.questions.map((question, questionIndex) => (
                <article className="question-editor" key={questionIndex}>
                  <div className="question-editor-head">
                    <strong>Question {questionIndex + 1}</strong>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={question.mandatory}
                        onChange={(event) =>
                          updateQuestion(questionIndex, "mandatory", event.target.checked)
                        }
                      />
                      Mandatory
                    </label>
                    {form.questions.length > 1 ? (
                      <button
                        className="icon-button danger"
                        type="button"
                        title="Remove question"
                        onClick={() => removeQuestion(questionIndex)}
                      >
                        <Trash2 size={17} />
                      </button>
                    ) : null}
                  </div>

                  <label>
                    Question text
                    <input
                      required
                      value={question.text}
                      onChange={(event) => updateQuestion(questionIndex, "text", event.target.value)}
                      placeholder="Which option best matches your preference?"
                    />
                  </label>

                  <div className="options-editor">
                    {question.options.map((option, optionIndex) => (
                      <div className="option-input" key={optionIndex}>
                        <span>{optionIndex + 1}</span>
                        <input
                          required={optionIndex < 2}
                          value={option.text}
                          onChange={(event) =>
                            updateOption(questionIndex, optionIndex, event.target.value)
                          }
                          placeholder={`Option ${optionIndex + 1}`}
                        />
                        {question.options.length > 2 ? (
                          <button
                            className="icon-button danger"
                            type="button"
                            title="Remove option"
                            onClick={() => removeOption(questionIndex, optionIndex)}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {question.options.length < 8 ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => addOption(questionIndex)}
                      >
                        <Plus size={16} />
                        Add option
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <aside className="builder-side">
          <div className="summary-panel">
            <CalendarClock size={22} />
            <h2>Ready check</h2>
            <dl>
              <div>
                <dt>Questions</dt>
                <dd>{form.questions.length}</dd>
              </div>
              <div>
                <dt>Options</dt>
                <dd>{totalOptions}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{form.responseMode === "AUTHENTICATED" ? "Authenticated" : "Anonymous"}</dd>
              </div>
            </dl>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="primary-button full" type="submit" disabled={busy}>
              <Check size={18} />
              {busy ? "Creating" : "Create poll"}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}
