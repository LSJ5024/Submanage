import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, id, className = '', ...props }: InputProps) {
  return (
    <div className={styles.wrap}>
      {label && <label htmlFor={id} className={styles.label}>{label}</label>}
      <input
        id={id}
        className={[styles.input, error ? styles.hasError : '', className].join(' ')}
        {...props}
      />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
